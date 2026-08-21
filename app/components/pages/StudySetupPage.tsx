"use client";

import { type CSSProperties, useMemo, useState } from "react";
import type { Attempt, Category, Question } from "../../db";
import { shuffle, type Filter } from "../../domain/quiz";
import { BackButton } from "../atoms/BackButton";

export function StudySetup({
  questions,
  categories,
  attempts,
  timeLimitOptions,
  onUpdateTimeLimits,
  onCancel,
  onStart,
}: {
  questions: Question[];
  categories: Category[];
  attempts: Attempt[];
  timeLimitOptions: number[];
  onUpdateTimeLimits: (options: number[]) => void;
  onCancel: () => void;
  onStart: (q: Question[], seconds: number) => void;
}) {
  const [categoryId, setCategoryId] = useState("all");
  const [count, setCount] = useState(Math.max(1, questions.length));
  const [countInput, setCountInput] = useState(
    String(Math.max(1, questions.length)),
  );
  const [limit, setLimit] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [newLimit, setNewLimit] = useState("");
  const available = useMemo(
    () =>
      questions
        .filter((q) => categoryId === "all" || q.categoryId === categoryId)
        .filter((q) => {
          const own = attempts.filter((a) => a.questionId === q.id);
          const last = own[0];
          if (filter === "last-wrong") return !!last && !last.correct;
          if (filter === "ever-wrong") return own.some((a) => !a.correct);
          if (filter === "unanswered") return own.length === 0;
          if (filter === "weak")
            return (
              own.length > 0 &&
              own.filter((a) => a.correct).length / own.length < 0.6
            );
          return true;
        }),
    [attempts, categoryId, filter, questions],
  );
  const sliderProgress =
    available.length <= 1
      ? 100
      : ((Math.min(count, available.length) - 1) / (available.length - 1)) *
        100;
  return (
    <section className="page setup-page">
      <BackButton onClick={onCancel}>ホームに戻る</BackButton>
      <div className="form-heading">
        <p className="eyebrow">STUDY SETUP</p>
        <h1>どんなふうに解きますか？</h1>
        <p>今日の気分に合わせて、出題内容を選びましょう。</p>
      </div>
      <div className="setup-card">
        <label>
          カテゴリ
          <select
            value={categoryId}
            onChange={(e) => {
              const nextCount = Math.max(
                1,
                questions.filter(
                  (question) =>
                    e.target.value === "all" ||
                    question.categoryId === e.target.value,
                ).length,
              );
              setCategoryId(e.target.value);
              setCount(nextCount);
              setCountInput(String(nextCount));
            }}
          >
            <option value="all">すべてのカテゴリ</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>出題範囲</legend>
          <div className="segmented">
            {(
              [
                ["all", "すべて"],
                ["last-wrong", "前回不正解"],
                ["ever-wrong", "不正解あり"],
                ["unanswered", "未回答"],
                ["weak", "苦手"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => {
                  const nextCount = Math.max(
                    1,
                    questions
                      .filter(
                        (question) =>
                          categoryId === "all" ||
                          question.categoryId === categoryId,
                      )
                      .filter((question) => {
                        const own = attempts.filter(
                          (attempt) => attempt.questionId === question.id,
                        );
                        const last = own[0];
                        if (value === "last-wrong")
                          return !!last && !last.correct;
                        if (value === "ever-wrong")
                          return own.some((attempt) => !attempt.correct);
                        if (value === "unanswered") return own.length === 0;
                        if (value === "weak")
                          return (
                            own.length > 0 &&
                            own.filter((attempt) => attempt.correct).length /
                              own.length <
                              0.6
                          );
                        return true;
                      }).length,
                  );
                  setFilter(value);
                  setCount(nextCount);
                  setCountInput(String(nextCount));
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>出題数</legend>
          <label className="count-entry">
            <input
              aria-label="出題数を直接入力"
              type="number"
              inputMode="numeric"
              min={1}
              max={Math.max(1, available.length)}
              step={1}
              value={available.length ? countInput : "0"}
              disabled={!available.length}
              onFocus={() => setCountInput("")}
              onBlur={() =>
                setCountInput(
                  String(Math.min(count, Math.max(1, available.length))),
                )
              }
              onChange={(event) => {
                const rawValue = event.target.value;
                setCountInput(rawValue);
                if (!rawValue) return;
                const value = Number(rawValue);
                if (!Number.isFinite(value)) return;
                const nextCount = Math.min(
                  Math.max(1, Math.trunc(value)),
                  Math.max(1, available.length),
                );
                setCount(nextCount);
                if (nextCount !== value) setCountInput(String(nextCount));
              }}
            />
            <span>問</span>
            <small>数字をタップして直接入力できます</small>
          </label>
          <div className="range-control">
            <input
              aria-label="出題数スライダー"
              type="range"
              min={available.length === 1 ? 0 : 1}
              max={Math.max(1, available.length)}
              value={
                available.length === 1
                  ? 1
                  : Math.min(count, Math.max(1, available.length))
              }
              disabled={available.length <= 1}
              style={
                { "--range-progress": `${sliderProgress}%` } as CSSProperties
              }
              onChange={(e) => {
                const nextCount = Number(e.target.value);
                setCount(nextCount);
                setCountInput(String(nextCount));
              }}
            />
            <div>
              <span>1問</span>
              <span>全{available.length}問</span>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>1問の制限時間</legend>
          {limit === 0 && (
            <p className="field-help">
              選択されていないため、制限時間なしです。
            </p>
          )}
          <div className="time-limit-manager">
            {timeLimitOptions.map((seconds) => (
              <div
                className={
                  limit === seconds
                    ? "time-limit-option active"
                    : "time-limit-option"
                }
                key={seconds}
              >
                <button
                  type="button"
                  onClick={() => setLimit(limit === seconds ? 0 : seconds)}
                >
                  {seconds}秒
                </button>
                <button
                  type="button"
                  className="remove-time"
                  aria-label={`${seconds}秒を削除`}
                  onClick={() => {
                    if (limit === seconds) setLimit(0);
                    onUpdateTimeLimits(
                      timeLimitOptions.filter((value) => value !== seconds),
                    );
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <form
            className="add-time-form"
            onSubmit={(event) => {
              event.preventDefault();
              const seconds = Number(newLimit);
              if (
                !Number.isInteger(seconds) ||
                seconds < 1 ||
                seconds > 3600 ||
                timeLimitOptions.includes(seconds)
              )
                return;
              onUpdateTimeLimits([...timeLimitOptions, seconds]);
              setLimit(seconds);
              setNewLimit("");
            }}
          >
            <label>
              時間を追加
              <input
                type="number"
                min="1"
                max="3600"
                step="1"
                value={newLimit}
                onChange={(event) => setNewLimit(event.target.value)}
                placeholder="例：45"
              />
              <span>秒</span>
            </label>
            <button
              type="submit"
              disabled={
                !newLimit || timeLimitOptions.includes(Number(newLimit))
              }
            >
              ＋ 追加
            </button>
          </form>
          <small className="field-help">1〜3600秒で追加できます。</small>
        </fieldset>
        <div className="setup-summary">
          <span>
            {available.length ? Math.min(count, available.length) : 0}
          </span>
          <p>
            問を出題します
            <br />
            <small>条件に合う全{available.length}問からランダムです</small>
          </p>
          <button
            className="button primary-button"
            disabled={!available.length}
            onClick={() => onStart(shuffle(available).slice(0, count), limit)}
          >
            学習を始める →
          </button>
        </div>
      </div>
    </section>
  );
}
