import type { Attempt, Question, StudySession } from "../../db";

export function Home({
  questions,
  attempts,
  sessions,
  onStudy,
  onCreate,
  onList,
}: {
  questions: Question[];
  attempts: Attempt[];
  sessions: StudySession[];
  onStudy: () => void;
  onCreate: () => void;
  onList: () => void;
}) {
  const answeredToday = attempts.filter(
    (a) => new Date(a.answeredAt).toDateString() === new Date().toDateString(),
  ).length;
  const latest = sessions[0];
  return (
    <section className="page home-page">
      <div className="hero">
        <div>
          <p className="eyebrow">今日も、ひとつずつ。</p>
          <h1>
            覚えたいことを、
            <br />
            <em>自分の問題</em>にしよう。
          </h1>
          <p>
            問題をつくる。解いてみる。間違いをもう一度。
            <br />
            あなた専用の学習帳です。
          </p>
        </div>
        <div className="hero-orbit">
          <span>?</span>
          <i>ABC</i>
          <b>○×</b>
        </div>
      </div>
      <div className="quick-grid">
        <button className="quick-card primary" onClick={onStudy}>
          <span className="quick-icon">▶</span>
          <div>
            <small>すぐに始める</small>
            <strong>問題を解く</strong>
            <p>
              {questions.length
                ? `${questions.length}問から出題できます`
                : "まずは問題を作りましょう"}
            </p>
          </div>
          <b>→</b>
        </button>
        <button className="quick-card" onClick={onCreate}>
          <span className="quick-icon amber">＋</span>
          <div>
            <small>かんたん登録</small>
            <strong>問題をつくる</strong>
            <p>4つの回答形式に対応</p>
          </div>
          <b>→</b>
        </button>
        <button className="quick-card" onClick={onList}>
          <span className="quick-icon violet">▤</span>
          <div>
            <small>登録内容を確認</small>
            <strong>問題一覧</strong>
            <p>
              {questions.length
                ? `${questions.length}問を登録中`
                : "問題はまだありません"}
            </p>
          </div>
          <b>→</b>
        </button>
      </div>
      <div className="section-heading">
        <div>
          <span className="tiny-line" />
          <h2>今日の学習</h2>
        </div>
        <span>
          {new Intl.DateTimeFormat("ja-JP", {
            month: "long",
            day: "numeric",
            weekday: "short",
          }).format(new Date())}
        </span>
      </div>
      <div className="stats-row">
        <article className="stat-card">
          <small>今日解いた問題</small>
          <strong>
            {answeredToday}
            <i>問</i>
          </strong>
          <span>
            {answeredToday ? "いいペースです" : "最初の一問を始めよう"}
          </span>
        </article>
        <article className="stat-card">
          <small>前回の正答率</small>
          <strong>
            {latest ? Math.round((latest.correct / latest.total) * 100) : 0}
            <i>%</i>
          </strong>
          <span>
            {latest
              ? `${latest.correct} / ${latest.total}問 正解`
              : "まだ記録がありません"}
          </span>
        </article>
        <article className="stat-card accent">
          <small>登録した問題</small>
          <strong>
            {questions.length}
            <i>問</i>
          </strong>
          <span>端末内に保存中</span>
        </article>
      </div>
      <aside className="reward-card" aria-label="楽天アフィリエイト広告">
        <div className="reward-copy">
          <small>広告・PR</small>
          <h2>がんばった自分に、ご褒美はいかがですか？</h2>
          <p>
            こちらのリンクを経由して購入いただくと、開発者に報酬が入り、ManaBloomを育てる励みになります。
          </p>
          <p className="reward-online">
            ※ オンラインのときにタップしてください。
          </p>
        </div>
        {/* eslint-disable-next-line react/jsx-no-target-blank */}
        <a
          href="https://hb.afl.rakuten.co.jp/hsc/568d73c9.aab63da7.564bf542.832cabdd/?link_type=text&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJ0ZXh0IiwiY29sIjoxLCJjYXQiOjEsImJhbiI6Im5hbWUiLCJhbXAiOmZhbHNlfQ%3D%3D"
          target="_blank"
          rel="nofollow sponsored noopener"
          style={{ wordWrap: "break-word" }}
        >
          楽天市場
        </a>
      </aside>
    </section>
  );
}
