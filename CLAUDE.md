# tabi-shiori

旅のしおりアプリ。React + tRPC + Express + Drizzle ORM 構成。

## セットアップ

```bash
cp .env.example .env.local
# .env.local に各値を設定
pnpm install
pnpm dev
```

## 技術スタック

- **フロントエンド**: React 19, Vite, TailwindCSS v4, tRPC client, TanStack Query
- **バックエンド**: Express, tRPC server, Drizzle ORM (MySQL)
- **パッケージマネージャー**: pnpm

## ディレクトリ構成

```
client/     フロントエンド (React)
server/     バックエンド (Express + tRPC)
  _core/    コアユーティリティ (env, map, oauth, vite...)
  routers.ts メインAPIルーター
shared/     クライアント・サーバー共通の型・定数
```

## 環境変数

`.env.example` を参照。ローカルでは `.env.local` に設定する。

## コマンド

```bash
pnpm dev        # 開発サーバー起動 (http://localhost:3001)
pnpm build      # プロダクションビルド
pnpm check      # TypeScript型チェック
pnpm test       # テスト実行
pnpm db:push    # DBマイグレーション
```

## 注意事項

- `.env.local` は絶対に読まない・コミットしない
- `pnpm` を使うこと（npm/yarn 不可）
- デプロイは GitHub main ブランチへの push で自動実行
