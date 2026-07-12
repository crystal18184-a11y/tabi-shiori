import { config as dotenvConfig } from "dotenv";

// ENV を組み立てる前に必ず環境変数をロードする（import順の罠を回避）
dotenvConfig({ path: ".env.local" }); // ローカル設定優先
dotenvConfig();                        // .env をフォールバック

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
};
