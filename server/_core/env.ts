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
  // Manusテンプレ由来のLLM/ストレージ/通知プロキシ用（設定時のみ各機能が有効）
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

// 起動に必須の環境変数。未設定のまま起動すると分かりにくいスタックトレースで
// 落ちるため、ここでまとめて検証し、明確なメッセージで即座に終了させる。
// OAUTH_SERVER_URL / VITE_APP_ID / OWNER_OPEN_ID はログイン機能専用で、
// 現状どのAPIもログイン必須(protectedProcedure)にしていないため任意項目とする。
const REQUIRED_ENV_KEYS = ["DATABASE_URL", "JWT_SECRET"] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV_KEYS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error("[ENV] 起動失敗: 以下の環境変数が未設定です:");
    for (const key of missing) {
      console.error(`  - ${key}`);
    }
    console.error(
      "[ENV] .env.local / .env、またはデプロイ先(Railway)の環境変数設定を確認してください。"
    );
    process.exit(1);
  }
}
