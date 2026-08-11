import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー｜ManaBloom",
  description: "ManaBloomにおける利用者情報の取り扱いについて",
};

export default function PrivacyPolicy() {
  return <main className="legal-page">
    <header className="legal-header"><Link href="/" className="legal-brand"><span>M</span><strong>ManaBloom</strong></Link><Link href="/" className="legal-back">アプリに戻る</Link></header>
    <article className="legal-card">
      <p className="eyebrow">PRIVACY POLICY</p>
      <h1>プライバシーポリシー</h1>
      <p className="legal-lead">ManaBloom運営（以下「運営者」）は、自主学習アプリ「ManaBloom」（以下「本アプリ」）における利用者情報を、次のとおり取り扱います。</p>

      <section><h2>1. 本アプリ内に保存されるデータ</h2><p>利用者が作成したカテゴリ・問題・回答、学習履歴および設定は、利用者の端末内に保存されます。これらの学習データを運営者のサーバーへ送信したり、運営者が閲覧したりすることはありません。</p></section>

      <section><h2>2. バックアップデータ</h2><p>バックアップ機能を利用すると、学習データがJSONファイルとして利用者の端末に書き出されます。バックアップファイルの保存、移動、共有および削除は利用者自身の操作で行われ、運営者はその内容を収集しません。</p></section>

      <section><h2>3. お問い合わせで取り扱う情報</h2><p>「メールで問い合わせる」から利用者がメールを送信した場合、送信元メールアドレス、メールに記載された名前および問い合わせ内容を運営者が受け取ります。これらは、問い合わせへの回答、不具合の調査、要望の検討および本アプリの改善にのみ利用します。</p></section>

      <section><h2>4. 第三者提供</h2><p>運営者は、法令に基づく場合を除き、受け取った個人情報を本人の同意なく第三者へ提供しません。メールの送受信、アプリ配信またはWeb配信に必要な事業者が情報を処理する場合は、各事業者のプライバシーポリシーが適用されます。</p></section>

      <section><h2>5. 広告・解析・追跡</h2><p>本アプリは、広告SDK、行動解析SDKおよび利用者を追跡する仕組みを使用していません。将来これらを導入する場合は、本ポリシーとApp Store上のプライバシー情報を更新します。</p></section>

      <section><h2>6. 保存期間と削除</h2><p>端末内の学習データは、利用者が問題を削除する、ブラウザやアプリのデータを消去する、または本アプリをアンインストールするまで保存されます。お問い合わせメールは、対応および記録に必要な期間だけ保管し、不要になった後に削除します。お問い合わせ情報の削除を希望する場合は、下記窓口へご連絡ください。ただし、法令上の保存義務がある場合を除きます。</p></section>

      <section><h2>7. 安全管理</h2><p>運営者は、受け取った個人情報への不正アクセス、紛失、漏えい等を防止するため、合理的な安全管理措置を講じます。利用者は、端末およびバックアップファイルを自身の責任で適切に管理してください。</p></section>

      <section><h2>8. 本ポリシーの変更</h2><p>機能追加、法令の変更その他必要に応じて、本ポリシーを変更することがあります。重要な変更がある場合は、本ページまたはアプリ内でお知らせします。</p></section>

      <section><h2>9. お問い合わせ窓口</h2><p>運営者：ManaBloom運営</p><p><a href="mailto:zardibuki@icloud.com?subject=ManaBloom%E3%81%AE%E3%83%97%E3%83%A9%E3%82%A4%E3%83%90%E3%82%B7%E3%83%BC%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B">zardibuki@icloud.com</a></p></section>

      <footer>制定日：2026年8月12日</footer>
    </article>
  </main>;
}
