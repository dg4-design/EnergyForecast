import { EnvCredentials } from "../types/api";

/**
 * 環境変数から認証情報を取得する
 */
export const getCredentialsFromEnv = (): EnvCredentials | null => {
  const { VITE_EMAIL, VITE_PASSWORD, VITE_ACCOUNT_NUMBER } = import.meta.env;

  if (!VITE_EMAIL || !VITE_PASSWORD || !VITE_ACCOUNT_NUMBER) {
    console.error("環境変数に必要な認証情報が設定されていません");
    return null;
  }

  return {
    email: VITE_EMAIL as string,
    password: VITE_PASSWORD as string,
    accountNumber: VITE_ACCOUNT_NUMBER as string,
  };
};

/**
 * 環境変数に認証情報が設定されているかチェックする
 */
export const hasEnvCredentials = (): boolean => {
  const { VITE_EMAIL, VITE_PASSWORD, VITE_ACCOUNT_NUMBER } = import.meta.env;
  return !!(VITE_EMAIL && VITE_PASSWORD && VITE_ACCOUNT_NUMBER);
};
