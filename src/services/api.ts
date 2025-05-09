import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { ElectricityUsageParams, LoginInput, RefreshTokenInput, HalfHourlyReading } from "../types/api";
import { cacheService } from "../utils/cacheUtils";

const API_URL = "https://api.oejp-kraken.energy/v1/graphql/";

// Axiosインスタンスを作成
const axiosInstance = axios.create({
  baseURL: API_URL,
});

let isRefreshing = false;
let failedQueue: { resolve: (value?: any) => void; reject: (reason?: any) => void; config: AxiosRequestConfig }[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      if (prom.config.headers) {
        prom.config.headers["Authorization"] = token;
      }
      axiosInstance(prom.config).then(prom.resolve).catch(prom.reject);
    }
  });
  failedQueue = [];
};

// ApiServiceのインスタンスでトークンを管理する
class ApiService {
  public token: string | null = null; // public に変更してインターセプターからアクセス可能に
  public refreshToken: string | null = null; // public に変更
  private onAuthError: (() => void) | null = null;

  setAuthErrorHandler(handler: () => void) {
    this.onAuthError = handler;
  }

  async login(credentials: LoginInput): Promise<void> {
    const loginMutation = `
      mutation login($input: ObtainJSONWebTokenInput!) {
        obtainKrakenToken(input: $input) {
          token
          refreshToken
        }
      }
    `;
    const variables = { input: credentials };
    try {
      const response = await axiosInstance.post("", {
        query: loginMutation,
        variables: variables,
      });
      if (response.data?.data?.obtainKrakenToken) {
        this.token = response.data.data.obtainKrakenToken.token;
        this.refreshToken = response.data.data.obtainKrakenToken.refreshToken;
        if (axiosInstance.defaults.headers.common) {
          axiosInstance.defaults.headers.common["Authorization"] = this.token;
        }
      } else {
        console.error("APIレスポンスにトークンが含まれていません:", response.data);
        if (response.data?.errors) {
          console.error("APIエラー詳細:", response.data.errors);
        }
        throw new Error("ログインに失敗しました");
      }
    } catch (error) {
      console.error("ログインエラー:", error);
      if (axios.isAxiosError(error) && error.response) {
        console.error("APIエラーステータス:", error.response.status);
        console.error("APIエラーデータ:", error.response.data);
      }
      throw error;
    }
  }

  async refreshAuthToken(): Promise<string | null> {
    if (!this.refreshToken) {
      console.error("リフレッシュトークンがありません");
      if (this.onAuthError) this.onAuthError();
      return null;
    }
    const refreshMutation = `
      mutation login($input: ObtainJSONWebTokenInput!) {
        obtainKrakenToken(input: $input) {
          token
          refreshToken
        }
      }
    `;
    const variables = { input: { refreshToken: this.refreshToken } as RefreshTokenInput };
    try {
      const response = await axiosInstance.post("", {
        query: refreshMutation,
        variables: variables,
      });
      if (response.data?.data?.obtainKrakenToken) {
        this.token = response.data.data.obtainKrakenToken.token;
        this.refreshToken = response.data.data.obtainKrakenToken.refreshToken;
        if (axiosInstance.defaults.headers.common) {
          axiosInstance.defaults.headers.common["Authorization"] = this.token;
        }
        return this.token;
      } else {
        console.error("APIレスポンスにトークンが含まれていません (リフレッシュ):", response.data);
        if (response.data?.errors) {
          console.error("APIエラー詳細 (リフレッシュ):", response.data.errors);
        }
        if (this.onAuthError) this.onAuthError();
        throw new Error("トークンリフレッシュに失敗しました");
      }
    } catch (error) {
      console.error("トークン更新エラー:", error);
      if (axios.isAxiosError(error) && error.response) {
        console.error("APIリフレッシュエラーステータス:", error.response.status);
        console.error("APIリフレッシュエラーデータ:", error.response.data);
      }
      if (this.onAuthError) this.onAuthError();
      throw error;
    }
  }

  async getElectricityUsage(params: ElectricityUsageParams): Promise<HalfHourlyReading[]> {
    // キャッシュキーを生成（パラメータをJSON文字列化）
    const cacheKey = `electricity_usage_${JSON.stringify(params)}`;

    // キャッシュをチェック
    const cachedData = cacheService.get<HalfHourlyReading[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // キャッシュがない場合はAPIリクエスト
    const usageQuery = `
      query halfHourlyReadings(
        $accountNumber: String!
        $fromDatetime: DateTime
        $toDatetime: DateTime
      ) {
        account(accountNumber: $accountNumber) {
          properties {
            electricitySupplyPoints {
              status
              agreements {
                validFrom
              }
              halfHourlyReadings(
                fromDatetime: $fromDatetime
                toDatetime: $toDatetime
              ) {
                ...halfHourlyReading
              }
            }
          }
        }
      }
      fragment halfHourlyReading on ElectricityHalfHourReading {
        consumptionRateBand
        consumptionStep
        costEstimate
        startAt
        value
      }
    `;
    try {
      const response = await axiosInstance.post("", {
        query: usageQuery,
        variables: params,
      });
      if (response.data?.data?.account?.properties?.[0]?.electricitySupplyPoints?.[0]?.halfHourlyReadings) {
        const data = response.data.data.account.properties[0].electricitySupplyPoints[0].halfHourlyReadings;
        // 結果をキャッシュに保存
        cacheService.set(cacheKey, data);
        return data;
      }
      if (response.data?.errors) {
        console.error("API GraphQLエラー:", response.data.errors);
      }
      return [];
    } catch (error) {
      console.error("使用量データ取得エラー (インターセプター後):", error);
      throw error;
    }
  }

  hasValidToken(): boolean {
    return !!this.token;
  }
}

export const apiService = new ApiService();

// リクエストインターセプター
axiosInstance.interceptors.request.use(
  (config) => {
    if (apiService.token && config.headers) {
      config.headers["Authorization"] = apiService.token; // Bearer プレフィックスはAPI仕様による
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }; // _retry プロパティを追加

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await apiService.refreshAuthToken();
        if (newToken) {
          if (originalRequest.headers) {
            // headers が存在するか確認
            originalRequest.headers["Authorization"] = newToken;
          }
          processQueue(null, newToken);
          return axiosInstance(originalRequest);
        } else {
          // リフレッシュ失敗時 (onAuthError は refreshAuthToken 内で呼ばれる想定)
          processQueue(new Error("Token refresh failed and no new token was provided"), null);
          return Promise.reject(error); // またはカスタムエラーを返す
        }
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        // onAuthError は refreshAuthToken 内で呼ばれる想定
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export type { HalfHourlyReading } from "../types/api";
