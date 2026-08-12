# ManaBloom

自分で問題を作成し、繰り返し学習できるオフライン対応の自主学習アプリです。

## 主な機能

- 問題・カテゴリの作成、編集、削除
- フリー入力、一文字ずつ4択、○×、択数回答
- 出題範囲、出題数、制限時間の設定
- 回答直後の正誤表示
- 日付ごとの学習履歴
- JSONファイルによるバックアップ、復元、別端末への移行
- PWAとしてのインストールとオフライン利用
- CapacitorによるiOSアプリ版

問題、回答履歴、設定はブラウザのIndexedDBへ保存されます。サーバーDBやログイン機能は使用していません。

## 開発環境

- Node.js 22.13.0以上
- React 19
- TypeScript
- vinext / Vite
- Dexie / IndexedDB

## 起動方法

```bash
npm install
npm run dev
```

## iOS用ファイルの同期

```bash
npm run ios:sync
```

このコマンドでiOS用Web資材をビルドし、`ios`プロジェクトへ同期します。App Store向けの署名・実機テスト・提出にはMacとXcodeが必要です。詳細は[iOSリリース手順](docs/05_iOSリリース手順.md)を参照してください。

## 品質確認

```bash
npm run build
npm run lint
npm test
npx tsc --noEmit
```

## 設計書

- [技術スタック](docs/01_技術スタック.md)
- [FE設計書](docs/02_FE設計書.md)
- [BE・データ設計書](docs/03_BE設計書.md)
- [テスト設計書](docs/04_テスト設計書.md)
- [iOSリリース手順](docs/05_iOSリリース手順.md)
