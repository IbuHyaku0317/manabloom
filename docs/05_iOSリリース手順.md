# ManaBloom iOSリリース手順

## 1. Windowsで完了している内容

- Capacitor iOSプロジェクトを`ios`に生成済み。
- アプリ名を`ManaBloom`、Bundle IDを`com.ibuhyaku.manabloom`に設定済み。
- Reactアプリ、プライバシーポリシー、サポートページをオフライン用に同梱。
- 問題・回答履歴・設定は端末内のIndexedDBへ永続保存。
- JSONバックアップをiOS共有シートへ渡すFilesystem／Share連携を実装。
- 1024×1024のApp Store用アイコンをiOSプロジェクトへ反映。

WindowsでWeb資材やプラグインを更新した後は、次を実行する。

```bash
npm install
npm run ios:sync
```

## 2. Macで必要なもの

- macOSを搭載したMac
- Xcode（Mac App Storeからインストール）
- Apple Developer Program登録済みのApple Account
- テスト用iPhone

## 3. Macへ移した直後

```bash
git clone https://github.com/IbuHyaku0317/manabloom.git
cd manabloom
npm install
npm run ios:sync
npx cap open ios
```

`npx cap open ios`でXcodeプロジェクトを開く。WindowsではXcodeを起動できないため、ここから先をMacで行う。

## 4. Xcode設定

1. `App`ターゲットのSigning & Capabilitiesを開く。
2. Apple Developer Programへ登録したTeamを選ぶ。
3. Bundle Identifierが`com.ibuhyaku.manabloom`であることを確認する。
4. Versionを`1.0`、Buildを`1`から開始する。
5. 実機iPhoneを選び、ビルド・起動する。

同じBundle IDがApple Developer側ですでに使われている場合は、`capacitor.config.ts`とXcodeのBundle Identifierを同じ新しい値へ変更する。

## 5. 実機・TestFlight確認

- `docs/04_テスト設計書.md`のiOSアプリテストを実施する。
- 特に再起動後のデータ保持、機内モード、バックアップ書き出し・復元、メール起動を確認する。
- XcodeのProduct > Archiveからアーカイブし、App Store Connectへアップロードする。
- TestFlightの内部テストで最終確認する。

## 6. App Store Connectで用意するもの

- アプリ名、サブタイトル、説明文、キーワード
- iPhoneスクリーンショット
- サポートURLとプライバシーポリシーURL
- 年齢区分、カテゴリ、著作権表示
- App Privacy回答（初期版はアカウント・サーバー送信なし。ただし実装と回答の一致を確認する）
- 審査用連絡先

サポートページとプライバシーポリシーはアプリ内に同梱しているが、App Store Connectには審査担当者がブラウザから閲覧できる公開URLも必要になる。
