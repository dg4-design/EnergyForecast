export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
}

export interface ElectricityUsageParams {
  accountNumber: string;
  fromDatetime: string;
  toDatetime: string;
}

export interface HalfHourlyReading {
  consumptionRateBand: string;
  consumptionStep: number;
  costEstimate: number;
  startAt: string;
  value: number;
}

export interface ElectricityUsageResponse {
  data: {
    account: {
      properties: Array<{
        electricitySupplyPoints: Array<{
          halfHourlyReadings: HalfHourlyReading[];
        }>;
      }>;
    };
  };
}

// 環境変数型定義
export interface EnvCredentials {
  email: string;
  password: string;
  accountNumber: string;
}
