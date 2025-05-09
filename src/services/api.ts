import axios from "axios";
import { ElectricityUsageParams, LoginInput, RefreshTokenInput, HalfHourlyReading } from "../types/api";

const API_URL = "https://api.oejp-kraken.energy/v1/graphql/"; // 正しいAPIエンドポイント

// デバッグ用：APIリクエストの詳細をコンソールに出力する関数
function logApiRequest(operation: string, query: string, variables: any, headers?: any) {
  console.group(`--- API ${operation}リクエスト ---`);
  console.log("URL:", API_URL);
  console.log("クエリ:", query);
  console.log("変数:", JSON.stringify(variables, null, 2));
  if (headers) {
    // トークンは一部だけ表示（セキュリティのため）
    const sanitizedHeaders = { ...headers };
    if (sanitizedHeaders.Authorization) {
      sanitizedHeaders.Authorization = sanitizedHeaders.Authorization.substring(0, 20) + "...";
    }
    console.log("ヘッダー:", sanitizedHeaders);
  }
  console.groupEnd();
}

class ApiService {
  private token: string | null = null;
  private refreshToken: string | null = null;

  // ログインしてトークンを取得
  async login(credentials: LoginInput): Promise<void> {
    const loginMutation = `
      mutation login($input: ObtainJSONWebTokenInput!) {
        obtainKrakenToken(input: $input) {
          token
          refreshToken
        }
      }
    `;

    const variables = {
      input: credentials,
    };

    // リクエスト情報をログに出力
    logApiRequest("ログイン", loginMutation, variables);

    try {
      const response = await axios.post(API_URL, {
        query: loginMutation,
        variables: variables,
      });

      // APIレスポンスをコンソールに出力
      console.log("ログインAPIレスポンス:", JSON.stringify(response.data));

      // レスポンス構造のチェック
      if (response.data && response.data.data && response.data.data.obtainKrakenToken) {
        this.token = response.data.data.obtainKrakenToken.token;
        this.refreshToken = response.data.data.obtainKrakenToken.refreshToken;
      } else {
        // APIエラーの詳細を表示
        console.error("APIレスポンスにトークンが含まれていません:", response.data);
        if (response.data && response.data.errors) {
          console.error("APIエラー詳細:", response.data.errors);
        }
        throw new Error("ログインに失敗しました");
      }
    } catch (error) {
      console.error("ログインエラー:", error);
      // axios エラーオブジェクトから詳細情報を取得
      if (axios.isAxiosError(error) && error.response) {
        console.error("APIエラーステータス:", error.response.status);
        console.error("APIエラーデータ:", error.response.data);
      }
      throw error;
    }
  }

  // リフレッシュトークンを使って新しいトークンを取得
  async refreshAuthToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error("リフレッシュトークンがありません");
    }

    const refreshMutation = `
      mutation login($input: ObtainJSONWebTokenInput!) {
        obtainKrakenToken(input: $input) {
          token
          refreshToken
        }
      }
    `;

    const variables = {
      input: {
        refreshToken: this.refreshToken,
      } as RefreshTokenInput,
    };

    // リクエスト情報をログに出力
    logApiRequest("トークンリフレッシュ", refreshMutation, variables);

    try {
      console.log("トークンリフレッシュを試みています...");

      const response = await axios.post(API_URL, {
        query: refreshMutation,
        variables: variables,
      });

      // APIレスポンスをコンソールに出力
      console.log("リフレッシュAPIレスポンス:", JSON.stringify(response.data));

      // レスポンス構造のチェック
      if (response.data && response.data.data && response.data.data.obtainKrakenToken) {
        this.token = response.data.data.obtainKrakenToken.token;
        this.refreshToken = response.data.data.obtainKrakenToken.refreshToken;
        console.log("トークンリフレッシュ成功");
      } else {
        // APIエラーの詳細を表示
        console.error("APIレスポンスにトークンが含まれていません:", response.data);
        if (response.data && response.data.errors) {
          console.error("APIエラー詳細:", response.data.errors);
        }
        throw new Error("トークンリフレッシュに失敗しました");
      }
    } catch (error) {
      console.error("トークン更新エラー:", error);
      // axios エラーオブジェクトから詳細情報を取得
      if (axios.isAxiosError(error) && error.response) {
        console.error("APIリフレッシュエラーステータス:", error.response.status);
        console.error("APIリフレッシュエラーデータ:", error.response.data);
      }
      throw error;
    }
  }

  // 電気使用量データを取得
  async getElectricityUsage(params: ElectricityUsageParams): Promise<HalfHourlyReading[]> {
    if (!this.token) {
      throw new Error("認証トークンがありません。先にログインしてください。");
    }

    // ドキュメントに記載されている正確なクエリとフラグメントを使用
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

    const headers = {
      Authorization: this.token,
    };

    // リクエスト情報をログに出力
    logApiRequest("使用量データ取得", usageQuery, params, headers);

    try {
      const response = await axios.post(
        API_URL,
        {
          query: usageQuery,
          variables: params,
        },
        {
          headers: headers,
        }
      );

      // レスポンスの構造を安全にチェック
      console.log("使用量データAPIレスポンス:", JSON.stringify(response.data));

      if (response.data && response.data.data && response.data.data.account) {
        const account = response.data.data.account;

        if (
          account.properties &&
          account.properties.length > 0 &&
          account.properties[0].electricitySupplyPoints &&
          account.properties[0].electricitySupplyPoints.length > 0 &&
          account.properties[0].electricitySupplyPoints[0].halfHourlyReadings
        ) {
          return account.properties[0].electricitySupplyPoints[0].halfHourlyReadings;
        }
      } else if (response.data && response.data.errors) {
        // GraphQLエラー情報を表示
        console.error("API GraphQLエラー:", response.data.errors);
      }

      // データが見つからない場合は空配列を返す
      console.log("データが見つかりませんでした。APIレスポンス:", response.data);
      return [];
    } catch (error) {
      console.error("使用量データ取得エラー:", error);
      // axios エラーオブジェクトから詳細情報を取得
      if (axios.isAxiosError(error) && error.response) {
        console.error("API使用量データエラーステータス:", error.response.status);
        console.error("API使用量データエラー詳細:", error.response.data);
      }
      throw error;
    }
  }

  // トークンの有無をチェック
  hasValidToken(): boolean {
    return !!this.token;
  }
}

export const apiService = new ApiService();
export type { HalfHourlyReading } from "../types/api";
