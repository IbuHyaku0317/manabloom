import type { Question } from "../../db";

export function Result({
  answers,
  onHome,
  onRetry,
}: {
  answers: { question: Question; answer: string; correct: boolean }[];
  onHome: () => void;
  onRetry: () => void;
}) {
  const correct = answers.filter((a) => a.correct).length;
  const percent = Math.round((correct / answers.length) * 100);
  return (
    <section className="page result-page">
      <div className="result-hero">
        <p className="eyebrow">SESSION COMPLETE</p>
        <h1>
          {percent >= 80
            ? "すばらしい結果です！"
            : percent >= 50
              ? "あと少し、伸びています。"
              : "間違いは、覚えるチャンス。"}
        </h1>
        <div
          className="score-ring"
          style={{
            background: `conic-gradient(var(--green) ${percent}%, #dfe9df ${percent}% 100%)`,
          }}
        >
          <strong>{percent}</strong>
          <span>%</span>
        </div>
        <p>
          {answers.length}問中 <b>{correct}問</b> 正解
        </p>
      </div>
      <div className="result-list">
        <h2>回答のふりかえり</h2>
        {answers.map((item, i) => (
          <article key={item.question.id}>
            <span className={item.correct ? "correct" : "wrong"}>
              {item.correct ? "✓" : "×"}
            </span>
            <div>
              <small>Q{i + 1}</small>
              <h3>{item.question.prompt}</h3>
              {!item.correct && (
                <p>
                  あなた：{item.answer || "未回答"} / 正解：
                  <b>{item.question.displayAnswer || item.question.answer}</b>
                  {item.question.answerType === "letters" &&
                  item.question.displayAnswer !== item.question.answer
                    ? `（入力：${item.question.answer}）`
                    : ""}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="result-actions">
        <button className="button ghost-button" onClick={onHome}>
          ホームへ
        </button>
        <button className="button primary-button" onClick={onRetry}>
          もう一度学習する
        </button>
      </div>
    </section>
  );
}
