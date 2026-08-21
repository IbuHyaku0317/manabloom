"use client";

import { useMemo, useState } from "react";
import type { Attempt, Question, StudySession } from "../../db";
import { truncateQuestionPrompt } from "../../domain/quiz";
import { PageTitle } from "../molecules/PageTitle";

export function History({
  attempts,
  sessions,
  questions,
  onEdit,
}: {
  attempts: Attempt[];
  sessions: StudySession[];
  questions: Question[];
  onEdit: (question: Question) => void;
}) {
  const [view, setView] = useState<"daily" | "all">("daily");
  const [selectedDate, setSelectedDate] = useState("");
  const questionName = (id: string) =>
    questions.find((q) => q.id === id)?.prompt ?? "削除済みの問題";
  const questionLink = (id: string) => {
    const question = questions.find((item) => item.id === id);
    return question ? (
      <button
        className="history-question-link"
        onClick={() => onEdit(question)}
      >
        <span title={question.prompt}>
          {truncateQuestionPrompt(question.prompt)}
        </span>
        <small>編集 →</small>
      </button>
    ) : (
      <h3>{questionName(id)}</h3>
    );
  };
  const totalCorrect = attempts.filter((a) => a.correct).length;
  const dailyGroups = useMemo(() => {
    const groups = new Map<string, Attempt[]>();
    for (const attempt of attempts) {
      const date = new Date(attempt.answeredAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      groups.set(key, [...(groups.get(key) ?? []), attempt]);
    }
    return [...groups.entries()];
  }, [attempts]);
  const dateLabel = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    const yesterday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 1,
    );
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    const prefix = sameDay(date, today)
      ? "今日・"
      : sameDay(date, yesterday)
        ? "昨日・"
        : "";
    return (
      prefix +
      new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(date)
    );
  };
  const visibleDailyGroups = selectedDate
    ? dailyGroups.filter(([date]) => date === selectedDate)
    : dailyGroups;
  return (
    <section className="page">
      <PageTitle
        eyebrow="LEARNING LOG"
        title="学習のきろく"
        description="積み重ねた回答と、これまでの成長。"
      />
      <div className="history-summary">
        <article>
          <small>これまでの回答</small>
          <strong>
            {attempts.length}
            <i>問</i>
          </strong>
        </article>
        <article>
          <small>全体の正答率</small>
          <strong>
            {attempts.length
              ? Math.round((totalCorrect / attempts.length) * 100)
              : 0}
            <i>%</i>
          </strong>
        </article>
        <article>
          <small>学習した回数</small>
          <strong>
            {sessions.length}
            <i>回</i>
          </strong>
        </article>
      </div>
      <div className="history-toolbar">
        <div>
          <span className="tiny-line" />
          <h2>{view === "daily" ? "日付ごとの学習" : "すべての回答"}</h2>
        </div>
        <div className="history-tabs">
          <button
            className={view === "daily" ? "active" : ""}
            onClick={() => setView("daily")}
          >
            日付ごと
          </button>
          <button
            className={view === "all" ? "active" : ""}
            onClick={() => setView("all")}
          >
            回答一覧
          </button>
        </div>
      </div>
      {view === "daily" && attempts.length > 0 && (
        <div className="date-picker">
          <label>
            表示する日付
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          <button disabled={!selectedDate} onClick={() => setSelectedDate("")}>
            すべての日付
          </button>
        </div>
      )}
      {attempts.length === 0 ? (
        <div className="empty-state compact">
          <span>◷</span>
          <h2>まだ履歴がありません</h2>
          <p>問題を解くと、ここに記録されます。</p>
        </div>
      ) : view === "daily" ? (
        visibleDailyGroups.length === 0 ? (
          <div className="empty-state compact">
            <span>⌗</span>
            <h2>この日の履歴はありません</h2>
            <p>別の日付を選ぶか、すべての日付を表示してください。</p>
            <button
              className="button ghost-button"
              onClick={() => setSelectedDate("")}
            >
              すべての日付を見る
            </button>
          </div>
        ) : (
          <div className="daily-history">
            {visibleDailyGroups.map(([date, dayAttempts]) => {
              const correct = dayAttempts.filter(
                (attempt) => attempt.correct,
              ).length;
              const rate = Math.round((correct / dayAttempts.length) * 100);
              return (
                <section className="day-group" key={date}>
                  <header>
                    <div>
                      <h3>{dateLabel(date)}</h3>
                      <p>
                        {dayAttempts.length}問中 {correct}問正解
                      </p>
                    </div>
                    <strong>
                      {rate}
                      <small>%</small>
                    </strong>
                  </header>
                  <div className="attempt-list">
                    {dayAttempts.map((a) => (
                      <article key={a.id}>
                        <span className={a.correct ? "correct" : "wrong"}>
                          {a.correct ? "✓" : "×"}
                        </span>
                        <div>
                          {questionLink(a.questionId)}
                          <p>
                            {new Intl.DateTimeFormat("ja-JP", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(a.answeredAt))}{" "}
                            ・ 回答「{a.answer || "未回答"}」
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : (
        <div className="attempt-list">
          {attempts.map((a) => (
            <article key={a.id}>
              <span className={a.correct ? "correct" : "wrong"}>
                {a.correct ? "✓" : "×"}
              </span>
              <div>
                {questionLink(a.questionId)}
                <p>
                  {new Intl.DateTimeFormat("ja-JP", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(a.answeredAt))}{" "}
                  ・ 回答「{a.answer || "未回答"}」
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
