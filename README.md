# Energy Forecast

電気使用量データを可視化するアプリケーション

## セットアップ

1. 依存関係をインストール:

```bash
npm install
```

2. 環境変数の設定:

ルートディレクトリに `.env` ファイルを作成し、以下の環境変数を設定してください:

```
# アカウント認証情報
VITE_EMAIL=your-email@example.com
VITE_PASSWORD=your-password
VITE_ACCOUNT_NUMBER=your-account-number
```

これらの環境変数は自動ログイン処理に使用されます。

3. 開発サーバーを起動:

```bash
npm run dev
```

## 機能

- 電気使用量データの時系列グラフ表示
- 日付範囲選択によるデータフィルタリング
- 環境変数を使った自動ログイン
- 月間使用量予測機能：月の最初から今日までの平均を元に月末までの使用量を予測

## 技術スタック

- React
- TypeScript
- Vite
- Chart.js
- Emotion (CSS-in-JS)

## ビルド手順

本番環境用にアプリケーションをビルドするには、以下の手順を実行してください：

1. 本番用ビルドを作成:

```bash
npm run build
```

2. ビルドされたファイルは `dist` ディレクトリに生成されます。

3. 本番ビルドをローカルでプレビューする場合:

```bash
npm run preview
```
