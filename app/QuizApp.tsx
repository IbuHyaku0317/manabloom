"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "./components/organisms/AppHeader";
import { BottomNavigation } from "./components/organisms/BottomNavigation";
import { History, Home, Library, Settings } from "./components/pages/MainPages";
import {
  QuestionForm,
  Quiz,
  Result,
  StudySetup,
} from "./components/pages/StudyFlowPages";
import {
  db,
  initializeDatabase,
  type Attempt,
  type Category,
  type Question,
  type StudySession,
} from "./db";
import {
  categoryColors,
  type QuizAnswer,
  type Screen,
  type Tab,
} from "./domain/quiz";

export default function QuizApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [screen, setScreen] = useState<Screen>("main");
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [toast, setToast] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [feedback, setFeedback] = useState<QuizAnswer | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [letterAnswer, setLetterAnswer] = useState("");
  const [timeLimit, setTimeLimit] = useState(0);
  const [timeLimitOptions, setTimeLimitOptions] = useState<number[]>([
    10, 30, 60,
  ]);
  const [remaining, setRemaining] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState(0);

  const refresh = useCallback(async () => {
    const [
      nextCategories,
      nextQuestions,
      nextAttempts,
      nextSessions,
      timeSettings,
    ] = await Promise.all([
      db.categories.orderBy("createdAt").toArray(),
      db.questions.orderBy("updatedAt").reverse().toArray(),
      db.attempts.orderBy("answeredAt").reverse().toArray(),
      db.sessions.orderBy("startedAt").reverse().toArray(),
      db.settings.get("timeLimits"),
    ]);
    setCategories(nextCategories);
    setQuestions(nextQuestions);
    setAttempts(nextAttempts);
    setSessions(nextSessions);
    setTimeLimitOptions(timeSettings?.numericValues ?? [10, 30, 60]);
  }, []);

  useEffect(() => {
    initializeDatabase().then(refresh);
    const isNativeApp = "Capacitor" in window;
    if (!isNativeApp && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.querySelector<HTMLElement>(".app-content")?.scrollTo(0, 0);
  }, [quizIndex, screen, tab]);

  const submitAnswer = useCallback(
    async (forcedAnswer?: string) => {
      if (feedback) return;
      const question = quizQuestions[quizIndex];
      if (!question) return;
      const answer =
        forcedAnswer ??
        (question.answerType === "letters" ? letterAnswer : currentAnswer);
      const correct = answer === question.answer;
      const elapsedSeconds = Math.max(
        0,
        Math.round((Date.now() - startedAt) / 1000),
      );
      const result = { question, answer, correct };
      const nextAnswers = [...quizAnswers, result];
      setFeedback(result);
      setFeedbackSaved(false);
      setQuizAnswers(nextAnswers);
      await db.attempts.add({
        id: crypto.randomUUID(),
        questionId: question.id,
        answer,
        correct,
        answeredAt: new Date().toISOString(),
        elapsedSeconds,
        sessionId,
      });
      setFeedbackSaved(true);
    },
    [
      currentAnswer,
      feedback,
      letterAnswer,
      quizAnswers,
      quizIndex,
      quizQuestions,
      sessionId,
      startedAt,
    ],
  );

  const continueQuiz = useCallback(async () => {
    if (!feedback || !feedbackSaved) return;
    if (quizIndex + 1 >= quizQuestions.length) {
      await db.sessions.add({
        id: sessionId,
        startedAt: new Date(sessionStartedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        total: quizAnswers.length,
        correct: quizAnswers.filter((item) => item.correct).length,
      });
      await refresh();
      setFeedback(null);
      setScreen("result");
    } else {
      setQuizIndex((value) => value + 1);
      setCurrentAnswer("");
      setLetterAnswer("");
      setRemaining(timeLimit);
      setStartedAt(Date.now());
      setFeedback(null);
      setFeedbackSaved(false);
    }
  }, [
    feedback,
    feedbackSaved,
    quizAnswers,
    quizIndex,
    quizQuestions.length,
    refresh,
    sessionId,
    sessionStartedAt,
    timeLimit,
  ]);

  useEffect(() => {
    if (screen !== "quiz" || timeLimit === 0 || feedback) return;
    const timer = window.setTimeout(() => {
      if (remaining <= 1) void submitAnswer("");
      else setRemaining((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [feedback, remaining, screen, submitAnswer, timeLimit]);

  const statsByQuestion = useMemo(() => {
    const map = new Map<
      string,
      { total: number; correct: number; last?: Attempt }
    >();
    for (const attempt of [...attempts].reverse()) {
      const stat = map.get(attempt.questionId) ?? { total: 0, correct: 0 };
      stat.total += 1;
      if (attempt.correct) stat.correct += 1;
      stat.last = attempt;
      map.set(attempt.questionId, stat);
    }
    return map;
  }, [attempts]);

  const showMain = (nextTab: Tab = tab) => {
    if (nextTab === "library") setSelectedCategory("all");
    setTab(nextTab);
    setScreen("main");
  };

  async function addCategory(name: string) {
    const clean = name.trim();
    if (!clean) return;
    await db.categories.add({
      id: crypto.randomUUID(),
      name: clean,
      color: categoryColors[categories.length % categoryColors.length],
      createdAt: new Date().toISOString(),
    });
    await refresh();
    setToast("カテゴリを追加しました");
  }

  async function updateTimeLimitOptions(options: number[]) {
    const normalized = [
      ...new Set(
        options.filter(
          (value) => Number.isInteger(value) && value > 0 && value <= 3600,
        ),
      ),
    ].sort((a, b) => a - b);
    await db.settings.put({ key: "timeLimits", numericValues: normalized });
    setTimeLimitOptions(normalized);
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`「${category.name}」と、その中の問題を削除しますか？`))
      return;
    const ids = await db.questions
      .where("categoryId")
      .equals(category.id)
      .primaryKeys();
    await db.transaction(
      "rw",
      db.categories,
      db.questions,
      db.attempts,
      async () => {
        await db.categories.delete(category.id);
        await db.questions.bulkDelete(ids);
        for (const id of ids)
          await db.attempts.where("questionId").equals(id).delete();
      },
    );
    if (selectedCategory === category.id) setSelectedCategory("all");
    await refresh();
    setToast("カテゴリを削除しました");
  }

  async function deleteQuestion(question: Question) {
    if (!window.confirm("この問題を削除しますか？")) return;
    await db.transaction("rw", db.questions, db.attempts, async () => {
      await db.questions.delete(question.id);
      await db.attempts.where("questionId").equals(question.id).delete();
    });
    await refresh();
    setToast("問題を削除しました");
  }

  function openQuestionForm(question: Question | null = null) {
    setEditingQuestion(question);
    setScreen("question-form");
  }

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? "未分類";

  return (
    <main className="app-shell">
      <AppHeader onHome={() => showMain("home")} />

      <div className="app-content">
        {screen === "main" && tab === "home" && (
          <Home
            questions={questions}
            attempts={attempts}
            sessions={sessions}
            onStudy={() => setScreen("study-setup")}
            onCreate={() => openQuestionForm()}
            onList={() => showMain("library")}
          />
        )}
        {screen === "main" && tab === "library" && (
          <Library
            categories={categories}
            questions={questions}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            categoryName={categoryName}
            statsByQuestion={statsByQuestion}
            onAddCategory={addCategory}
            onDeleteCategory={deleteCategory}
            onCreate={() => openQuestionForm()}
            onEdit={openQuestionForm}
            onDelete={deleteQuestion}
            onBulkChanged={async (message) => {
              await refresh();
              setToast(message);
            }}
          />
        )}
        {screen === "main" && tab === "history" && (
          <History
            attempts={attempts}
            sessions={sessions}
            questions={questions}
            onEdit={openQuestionForm}
          />
        )}
        {screen === "main" && tab === "settings" && (
          <Settings
            onRestored={async () => {
              await refresh();
              setToast("バックアップを復元しました");
            }}
          />
        )}
        {screen === "question-form" && (
          <QuestionForm
            categories={categories}
            question={editingQuestion}
            onCancel={() => showMain(editingQuestion ? "library" : "home")}
            onSaved={async () => {
              await refresh();
              showMain("library");
              setToast(
                editingQuestion ? "問題を更新しました" : "問題を作成しました",
              );
            }}
          />
        )}
        {screen === "study-setup" && (
          <StudySetup
            questions={questions}
            categories={categories}
            attempts={attempts}
            timeLimitOptions={timeLimitOptions}
            onUpdateTimeLimits={(options) =>
              void updateTimeLimitOptions(options)
            }
            onCancel={() => showMain("home")}
            onStart={(items, seconds) => {
              setQuizQuestions(items);
              setQuizIndex(0);
              setQuizAnswers([]);
              setFeedback(null);
              setFeedbackSaved(false);
              setCurrentAnswer("");
              setLetterAnswer("");
              const now = Date.now();
              setTimeLimit(seconds);
              setRemaining(seconds);
              setSessionId(crypto.randomUUID());
              setStartedAt(now);
              setSessionStartedAt(now);
              setScreen("quiz");
            }}
          />
        )}
        {screen === "quiz" && quizQuestions[quizIndex] && (
          <Quiz
            question={quizQuestions[quizIndex]}
            index={quizIndex}
            total={quizQuestions.length}
            answer={currentAnswer}
            letterAnswer={letterAnswer}
            remaining={remaining}
            timeLimit={timeLimit}
            category={categoryName(quizQuestions[quizIndex].categoryId)}
            feedback={feedback}
            feedbackSaved={feedbackSaved}
            onAnswer={setCurrentAnswer}
            onLetter={setLetterAnswer}
            onSubmit={(forcedAnswer) => void submitAnswer(forcedAnswer)}
            onContinue={() => void continueQuiz()}
            onQuit={() => {
              if (window.confirm("学習を終了しますか？")) showMain("home");
            }}
          />
        )}
        {screen === "result" && (
          <Result
            answers={quizAnswers}
            onHome={() => showMain("home")}
            onRetry={() => setScreen("study-setup")}
          />
        )}
      </div>

      {screen === "main" && (
        <BottomNavigation activeTab={tab} onSelect={showMain} />
      )}
      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
        </div>
      )}
    </main>
  );
}
