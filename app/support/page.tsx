import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "サポート｜ManaBloom",
  description: "ManaBloomの使い方、データ管理、よくある質問、お問い合わせ",
};

const contactHref = `mailto:zardibuki@icloud.com?subject=${encodeURIComponent("ManaBloomへのお問い合わせ")}&body=${encodeURIComponent("ご意見、不具合、追加してほしい機能：\n\n\n---\nアプリ：ManaBloom 0.1.0")}`;

export default function Support() {
  return <main className="legal-page support-page">
    <header className="legal-header"><Link href="/" className="legal-brand"><span>M</span><strong>ManaBloom</strong></Link><Link href="/" className="legal-back">アプリに戻る</Link></header>
    <article className="legal-card">
      <p className="eyebrow">SUPPORT</p>
      <h1>サポート</h1>
      <p className="legal-lead">ManaBloomの使い方やデータについて、よくある質問をご案内します。解決しない場合は、ページ下部からお問い合わせください。</p>

      <nav className="support-index" aria-label="サポート項目"><a href="#data">データ保存</a><a href="#backup">端末移行</a><a href="#offline">オフライン</a><a href="#contact">お問い合わせ</a></nav>

      <section id="data"><h2>問題や履歴はどこに保存されますか？</h2><p>カテゴリ、問題、回答履歴、学習履歴および設定は、利用中の端末内に保存されます。アプリを閉じたり端末を再起動したりしても、通常はデータが残ります。</p><p>アプリの削除、ブラウザのサイトデータ削除、シークレットモードの終了などにより消える場合があるため、大切なデータは定期的にバックアップしてください。</p></section>

      <section id="backup"><h2>別の端末へデータを移すには？</h2><ol><li>元の端末で「設定」を開きます。</li><li>「バックアップを書き出す」を押し、JSONファイルを保存します。</li><li>移行先の端末でManaBloomの「設定」を開きます。</li><li>「バックアップを選ぶ」からJSONファイルを選び、内容を確認して復元します。</li></ol><p>復元すると移行先の現在データが置き換わります。復元直前のデータは自動的に別ファイルへ書き出されます。</p></section>

      <section id="offline"><h2>オフラインでも使えますか？</h2><p>一度オンラインで起動して必要なデータを読み込んだ後は、基本的な問題作成、回答、履歴確認をオフラインでも利用できます。初回起動、インストール、アプリ更新にはインターネット接続が必要です。</p></section>

      <section><h2>正解なのに不正解になります</h2><p>フリー入力は、登録した答えとの完全一致で判定します。大文字・小文字、全角・半角、空白の違いも別の文字として扱われます。問題一覧から対象問題を編集し、回答時に入力する答えをご確認ください。</p></section>

      <section><h2>制限時間を設定しない場合は？</h2><p>出題設定で秒数を選択していない状態が「制限時間なし」です。選択中の秒数をもう一度押すと、選択を解除できます。</p></section>

      <section id="contact" className="support-contact"><h2>お問い合わせ</h2><p>ご意見、不具合、追加してほしい機能の報告を受け付けています。次のボタンを押すと、宛先と件名を入力した状態で端末のメールアプリが開きます。</p><a className="button primary-button" href={contactHref}>メールで問い合わせる</a><p className="support-email">送信先：zardibuki@icloud.com</p></section>

      <footer><Link href="/privacy">プライバシーポリシー</Link><span>ManaBloom 0.1.0</span></footer>
    </article>
  </main>;
}
