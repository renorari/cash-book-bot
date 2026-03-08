# money-count-bot

Discord サーバー向けのシンプルな金銭出納帳 Bot です。`/add` で記帳し、`/cashbook` で一覧・合計を確認できます。

## 主な機能

- `/ping`: Bot の応答確認（WebSocket/API レイテンシー表示）
- `/add`: 記帳を追加
  - `date` (`YYYY-MM-DD`)
  - `description` (内容)
  - `amount` (収入は正、支出は負)
- `/cashbook`: 出納帳一覧を表示
  - 月間合計（当月）
  - 全体合計
  - ボタン操作で行を論理削除（`isRemoved = true`）
- 監査ログ記録
  - 追加時: `ADD_ENTRY`
  - 削除時: `REMOVE_ENTRY`

## 技術スタック

- Node.js `>= 22`
- Discord API: `discord.js`
- ORM: `Prisma`
- DB: `PostgreSQL`
- Logging: `log4js`

## データモデル

- `CashBook`
  - `id`, `date`, `description`, `amount`, `isRemoved`
- `AuditLog`
  - `id`, `userId`, `action`, `details`, `timestamp`

スキーマ定義は `prisma/schema.prisma` を参照してください。

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

2. 環境変数を設定

`.env.template` を参考に `.env` を作成してください。

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN
```

3. Prisma Client を生成

```bash
npm run prisma:generate
```

4. マイグレーションを適用

```bash
npm run prisma:migrate
```

## 起動

```bash
npm start
```

初回起動時に Slash コマンドが自動登録されます。

## 開発用コマンド

```bash
npm run lint
npm run lint:fix
npm run prisma:studio
```

## Bot 招待

`bot` と `applications.commands` スコープを付けて Bot をサーバーに招待してください。

## ログ

- 開発環境: コンソール出力
- 本番環境 (`NODE_ENV=production`):
  - コンソール（info 以上）
  - `logs/discord.log` に日次ローテーション出力

## ライセンス

`GPL-3.0-only`（`LICENCE` を参照）
