/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EMAIL: string;
  readonly VITE_PASSWORD: string;
  readonly VITE_ACCOUNT_NUMBER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
