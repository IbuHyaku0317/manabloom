"use client";

import { type FormEvent, useState } from "react";
import { db, type AnswerType, type Category, type Question } from "../../db";
import { answerLabels } from "../../domain/quiz";
import { BackButton } from "../atoms/BackButton";

export function QuestionForm({
  categories,
  question,
  onCancel,
  onSaved,
}: {
  categories: Category[];
  question: Question | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [answer, setAnswer] = useState(question?.answer ?? "");
  const [displayAnswer, setDisplayAnswer] = useState(
    question?.displayAnswer ?? question?.answer ?? "",
  );
  const [categoryId, setCategoryId] = useState(
    question?.categoryId ?? "uncategorized",
  );
  const [answerType, setAnswerType] = useState<AnswerType>(
    question?.answerType ?? "text",
  );
  const [choiceCount, setChoiceCount] = useState(
    question?.choices?.length ?? 4,
  );
  const [choices, setChoices] = useState<string[]>(
    question?.choices ?? ["", "", "", ""],
  );
  const [correctChoiceIndex, setCorrectChoiceIndex] = useState(
    question?.correctChoiceIndex ?? 0,
  );
  const visibleChoices = choices.slice(0, choiceCount);
  const multipleChoiceValid =
    visibleChoices.length === choiceCount &&
    visibleChoices.every((choice) => choice.trim()) &&
    new Set(visibleChoices.map((choice) => choice.trim())).size ===
      choiceCount &&
    correctChoiceIndex < choiceCount;
  function changeChoiceCount(count: number) {
    setChoiceCount(count);
    setChoices((current) =>
      Array.from({ length: count }, (_, index) => current[index] ?? ""),
    );
    if (correctChoiceIndex >= count) setCorrectChoiceIndex(0);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const cleanChoices = visibleChoices.map((choice) => choice.trim());
    const savedAnswer =
      answerType === "multiple-choice"
        ? cleanChoices[correctChoiceIndex]
        : answer.trim();
    const item: Question = {
      id: question?.id ?? crypto.randomUUID(),
      prompt: prompt.trim(),
      answer: savedAnswer,
      displayAnswer:
        answerType === "letters" ? displayAnswer.trim() : savedAnswer,
      choices: answerType === "multiple-choice" ? cleanChoices : undefined,
      correctChoiceIndex:
        answerType === "multiple-choice" ? correctChoiceIndex : undefined,
      categoryId,
      answerType,
      createdAt: question?.createdAt ?? now,
      updatedAt: now,
    };
    await db.questions.put(item);
    onSaved();
  }
  return (
    <section className="page form-page">
      <BackButton onClick={onCancel}>
        {question ? "問題一覧に戻る" : "ホームに戻る"}
      </BackButton>
      <div className="form-heading">
        <p className="eyebrow">CREATE QUESTION</p>
        <h1>{question ? "問題を編集" : "新しい問題をつくる"}</h1>
        <p>あとで自分が迷わない、シンプルな問題がおすすめです。</p>
      </div>
      <form className="editor-card" onSubmit={save}>
        <label>
          カテゴリ
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="uncategorized">カテゴリなし</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>回答方式</legend>
          <div className="type-grid">
            {(
              ["text", "letters", "boolean", "multiple-choice"] as AnswerType[]
            ).map((type) => (
              <button
                type="button"
                key={type}
                className={
                  answerType === type ? "type-card active" : "type-card"
                }
                onClick={() => {
                  setAnswerType(type);
                  setAnswer("");
                }}
              >
                <span>
                  {type === "text"
                    ? "Aa"
                    : type === "letters"
                      ? "A B C"
                      : type === "boolean"
                        ? "○ ×"
                        : "☑"}
                </span>
                <strong>{answerLabels[type]}</strong>
                <small>
                  {type === "text"
                    ? "答えを直接入力"
                    : type === "letters"
                      ? "1文字ずつ選ぶ"
                      : type === "boolean"
                        ? "正しいか間違いか"
                        : "選択肢から1つ選ぶ"}
                </small>
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          問題文
          <textarea
            required
            rows={4}
            value={prompt}
            maxLength={500}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例：日本の首都はどこ？"
          />
          <small className="counter">{prompt.length} / 500</small>
        </label>
        {answerType === "boolean" ? (
          <fieldset>
            <legend>正解</legend>
            <div className="boolean-select">
              <button
                type="button"
                className={answer === "○" ? "active" : ""}
                onClick={() => setAnswer("○")}
              >
                ○<small>正しい</small>
              </button>
              <button
                type="button"
                className={answer === "×" ? "active" : ""}
                onClick={() => setAnswer("×")}
              >
                ×<small>間違い</small>
              </button>
            </div>
          </fieldset>
        ) : answerType === "letters" ? (
          <div className="letter-answer-fields">
            <label>
              画面に表示する答え
              <input
                required
                value={displayAnswer}
                onChange={(e) => setDisplayAnswer(e.target.value)}
                placeholder="例：りんご"
              />
              <small>問題一覧や回答結果に表示する答えです。</small>
            </label>
            <label>
              回答時に入力する答え
              <input
                required
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="例：APPLE"
              />
              <small>この文字を一文字ずつ4択で入力します。</small>
            </label>
          </div>
        ) : answerType === "multiple-choice" ? (
          <fieldset className="choice-editor">
            <legend>選択肢をつくる</legend>
            <label className="choice-count">
              何択にしますか？
              <select
                value={choiceCount}
                onChange={(event) =>
                  changeChoiceCount(Number(event.target.value))
                }
              >
                {Array.from({ length: 9 }, (_, index) => index + 2).map(
                  (count) => (
                    <option key={count} value={count}>
                      {count}択
                    </option>
                  ),
                )}
              </select>
            </label>
            <p className="choice-help">
              正解にする選択肢の丸を選んでください。
            </p>
            <div className="choice-inputs">
              {visibleChoices.map((choice, index) => (
                <div
                  className={
                    correctChoiceIndex === index
                      ? "choice-row correct-choice"
                      : "choice-row"
                  }
                  key={index}
                >
                  <input
                    type="radio"
                    name="correct-choice"
                    checked={correctChoiceIndex === index}
                    onChange={() => setCorrectChoiceIndex(index)}
                    aria-label={`選択肢${index + 1}を正解にする`}
                  />
                  <span>{index + 1}</span>
                  <input
                    type="text"
                    required
                    value={choice}
                    onChange={(event) =>
                      setChoices((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    placeholder={`選択肢 ${index + 1}`}
                  />
                </div>
              ))}
            </div>
            {visibleChoices.some((choice) => choice.trim()) &&
              new Set(
                visibleChoices.map((choice) => choice.trim()).filter(Boolean),
              ).size !==
                visibleChoices.filter((choice) => choice.trim()).length && (
                <small className="form-error">
                  同じ選択肢は重複して登録できません。
                </small>
              )}
          </fieldset>
        ) : (
          <label>
            正解
            <input
              required
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="例：東京"
            />
            <small>正誤は文字の完全一致で判定します。</small>
          </label>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button ghost-button"
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button
            className="button primary-button"
            disabled={
              !prompt.trim() ||
              (answerType === "multiple-choice"
                ? !multipleChoiceValid
                : !answer.trim()) ||
              (answerType === "letters" && !displayAnswer.trim()) ||
              !categoryId
            }
          >
            {question ? "変更を保存" : "問題を保存"}
          </button>
        </div>
      </form>
    </section>
  );
}
