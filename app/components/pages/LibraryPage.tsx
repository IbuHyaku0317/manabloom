"use client";

import { useState } from "react";
import { db, type Attempt, type Category, type Question } from "../../db";
import { answerLabels, truncateQuestionPrompt } from "../../domain/quiz";
import { PageTitle } from "../molecules/PageTitle";

export function Library({
  categories,
  questions,
  selectedCategory,
  onSelectCategory,
  categoryName,
  statsByQuestion,
  onAddCategory,
  onDeleteCategory,
  onCreate,
  onEdit,
  onDelete,
  onBulkChanged,
}: {
  categories: Category[];
  questions: Question[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  categoryName: (id: string) => string;
  statsByQuestion: Map<
    string,
    { total: number; correct: number; last?: Attempt }
  >;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (category: Category) => void;
  onCreate: () => void;
  onEdit: (q: Question) => void;
  onDelete: (q: Question) => void;
  onBulkChanged: (message: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [changingCategory, setChangingCategory] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState("uncategorized");
  const visibleQuestions =
    selectedCategory === "all"
      ? questions
      : questions.filter(
          (question) => question.categoryId === selectedCategory,
        );
  function selectCategory(id: string) {
    setSelectedIds([]);
    setChangingCategory(false);
    onSelectCategory(id);
  }
  function toggleQuestion(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  async function changeSelectedCategory() {
    const selectedQuestions = questions.filter((question) =>
      selectedIds.includes(question.id),
    );
    if (!selectedQuestions.length) return;
    const now = new Date().toISOString();
    await db.questions.bulkPut(
      selectedQuestions.map((question) => ({
        ...question,
        categoryId: bulkCategoryId,
        updatedAt: now,
      })),
    );
    setSelectedIds([]);
    setChangingCategory(false);
    await onBulkChanged(
      `${selectedQuestions.length}問のカテゴリを変更しました`,
    );
  }
  async function deleteSelectedQuestions() {
    if (
      !selectedIds.length ||
      !window.confirm(
        `選択した${selectedIds.length}問を削除しますか？\nこの操作は元に戻せません。`,
      )
    )
      return;
    const ids = [...selectedIds];
    await db.transaction("rw", db.questions, db.attempts, async () => {
      await db.questions.bulkDelete(ids);
      for (const id of ids)
        await db.attempts.where("questionId").equals(id).delete();
    });
    setSelectedIds([]);
    setChangingCategory(false);
    await onBulkChanged(`${ids.length}問を削除しました`);
  }
  return (
    <section className="page">
      <PageTitle
        eyebrow="MY QUESTIONS"
        title="問題ライブラリ"
        description="カテゴリで整理して、いつでも学習できます。"
        className="library-title"
        action={
          <button className="button primary-button" onClick={onCreate}>
            ＋ 新しい問題を追加
          </button>
        }
      />
      <div className="category-strip">
        <button
          className={
            selectedCategory === "all"
              ? "category-chip active"
              : "category-chip"
          }
          onClick={() => selectCategory("all")}
        >
          <i style={{ background: "#333" }} />
          すべて
        </button>
        {categories.map((category) => (
          <div className="category-wrap" key={category.id}>
            <button
              className={
                selectedCategory === category.id
                  ? "category-chip active"
                  : "category-chip"
              }
              onClick={() => selectCategory(category.id)}
            >
              <i style={{ background: category.color }} />
              {category.name}
            </button>
            <button
              className="chip-delete"
              aria-label={`${category.name}を削除`}
              onClick={() => onDeleteCategory(category)}
            >
              ×
            </button>
          </div>
        ))}
        {adding ? (
          <form
            className="category-add"
            onSubmit={(e) => {
              e.preventDefault();
              onAddCategory(name);
              setName("");
              setAdding(false);
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="カテゴリ名"
              aria-label="新しいカテゴリ名"
            />
            <button>追加</button>
          </form>
        ) : (
          <button className="category-chip add" onClick={() => setAdding(true)}>
            ＋ カテゴリ
          </button>
        )}
      </div>
      {visibleQuestions.length === 0 ? (
        <div className="empty-state">
          <span>✎</span>
          <h2>まだ問題がありません</h2>
          <p>覚えたいことを、最初の問題にしてみましょう。</p>
          <button className="button primary-button" onClick={onCreate}>
            最初の問題をつくる
          </button>
        </div>
      ) : (
        <div className="question-list">
          {visibleQuestions.map((question) => {
            const stat = statsByQuestion.get(question.id);
            const selected = selectedIds.includes(question.id);
            return (
              <article
                className={selected ? "question-row selected" : "question-row"}
                key={question.id}
              >
                <button
                  type="button"
                  className={
                    selected
                      ? "question-selector selected"
                      : "question-selector"
                  }
                  aria-label={`${question.prompt}を${selected ? "選択解除" : "選択"}`}
                  aria-pressed={selected}
                  onClick={() => toggleQuestion(question.id)}
                >
                  {selected ? "✓" : ""}
                </button>
                <div className="answer-type">
                  {question.answerType === "boolean"
                    ? "○×"
                    : question.answerType === "letters"
                      ? "4択"
                      : question.answerType === "multiple-choice"
                        ? `${question.choices?.length ?? 0}択`
                        : "入力"}
                </div>
                <div className="question-copy">
                  <div>
                    <span>{categoryName(question.categoryId)}</span>
                    <small>{answerLabels[question.answerType]}</small>
                  </div>
                  <h3 title={question.prompt}>
                    {truncateQuestionPrompt(question.prompt)}
                  </h3>
                  <p>
                    答え：{question.displayAnswer || question.answer}
                    {question.answerType === "letters" &&
                    question.displayAnswer !== question.answer
                      ? `（入力：${question.answer}）`
                      : ""}
                  </p>
                </div>
                <div className="question-stat">
                  {stat ? (
                    <>
                      <strong>
                        {Math.round((stat.correct / stat.total) * 100)}%
                      </strong>
                      <small>{stat.total}回答</small>
                    </>
                  ) : (
                    <small>未回答</small>
                  )}
                </div>
                <div className="row-actions">
                  <button onClick={() => onEdit(question)}>編集</button>
                  <button
                    className="danger-link"
                    onClick={() => onDelete(question)}
                  >
                    削除
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {selectedIds.length > 0 && (
        <>
          <div
            className="bulk-action-bar"
            role="toolbar"
            aria-label="選択した問題の操作"
          >
            <strong>{selectedIds.length}問選択中</strong>
            <button
              type="button"
              onClick={() => setChangingCategory((current) => !current)}
            >
              カテゴリ変更
            </button>
            <button
              type="button"
              className="bulk-clear"
              onClick={() => {
                setSelectedIds([]);
                setChangingCategory(false);
              }}
            >
              選択クリア
            </button>
            <button
              type="button"
              className="bulk-delete"
              onClick={() => void deleteSelectedQuestions()}
            >
              削除
            </button>
          </div>
          {changingCategory && (
            <div className="bulk-category-panel">
              <label>
                変更先
                <select
                  value={bulkCategoryId}
                  onChange={(event) => setBulkCategoryId(event.target.value)}
                >
                  <option value="uncategorized">カテゴリなし</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button ghost-button"
                onClick={() => setChangingCategory(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="button primary-button"
                onClick={() => void changeSelectedCategory()}
              >
                変更する
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
