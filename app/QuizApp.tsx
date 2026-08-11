"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { db, initializeDatabase, type AnswerType, type Attempt, type Category, type Question, type StudySession } from "./db";

type Tab = "home" | "library" | "history" | "settings";
type Screen = "main" | "question-form" | "study-setup" | "quiz" | "result";
type Filter = "all" | "last-wrong" | "ever-wrong" | "unanswered" | "weak";

const colors = ["#557c6b", "#e9a23b", "#cf705c", "#6b7da8", "#8b77a8"];
const answerLabels: Record<AnswerType, string> = { text: "フリー入力", letters: "一文字ずつ4択", boolean: "○×問題" };

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

function makeLetterChoices(answer: string, index: number) {
  const right = answer[index];
  const pool = /[A-Za-z]/.test(right)
    ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    : "あいうえおかきくけこさしすせそたちつてとなにぬねの0123456789";
  const wrong = shuffle([...new Set([...pool].filter((letter) => letter !== right))]).slice(0, 3);
  return shuffle([right, ...wrong]);
}

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
  const [quizAnswers, setQuizAnswers] = useState<{ question: Question; answer: string; correct: boolean }[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [letterAnswer, setLetterAnswer] = useState("");
  const [timeLimit, setTimeLimit] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState(0);

  const refresh = useCallback(async () => {
    const [nextCategories, nextQuestions, nextAttempts, nextSessions] = await Promise.all([
      db.categories.orderBy("createdAt").toArray(),
      db.questions.orderBy("updatedAt").reverse().toArray(),
      db.attempts.orderBy("answeredAt").reverse().toArray(),
      db.sessions.orderBy("startedAt").reverse().toArray(),
    ]);
    setCategories(nextCategories);
    setQuestions(nextQuestions);
    setAttempts(nextAttempts);
    setSessions(nextSessions);
  }, []);

  useEffect(() => {
    initializeDatabase().then(refresh);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const submitAnswer = useCallback(async (forcedAnswer?: string) => {
    const question = quizQuestions[quizIndex];
    if (!question) return;
    const answer = forcedAnswer ?? (question.answerType === "letters" ? letterAnswer : currentAnswer);
    const correct = answer === question.answer;
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    await db.attempts.add({
      id: crypto.randomUUID(), questionId: question.id, answer, correct,
      answeredAt: new Date().toISOString(), elapsedSeconds, sessionId,
    });
    const nextAnswers = [...quizAnswers, { question, answer, correct }];
    setQuizAnswers(nextAnswers);
    if (quizIndex + 1 >= quizQuestions.length) {
      await db.sessions.add({
        id: sessionId, startedAt: new Date(sessionStartedAt).toISOString(),
        finishedAt: new Date().toISOString(), total: nextAnswers.length,
        correct: nextAnswers.filter((item) => item.correct).length,
      });
      await refresh();
      setScreen("result");
    } else {
      setQuizIndex((value) => value + 1);
      setCurrentAnswer("");
      setLetterAnswer("");
      setRemaining(timeLimit);
      setStartedAt(Date.now());
    }
  }, [currentAnswer, letterAnswer, quizAnswers, quizIndex, quizQuestions, refresh, sessionId, sessionStartedAt, startedAt, timeLimit]);

  useEffect(() => {
    if (screen !== "quiz" || timeLimit === 0) return;
    const timer = window.setTimeout(() => {
      if (remaining <= 1) void submitAnswer("");
      else setRemaining((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [remaining, screen, submitAnswer, timeLimit]);

  const statsByQuestion = useMemo(() => {
    const map = new Map<string, { total: number; correct: number; last?: Attempt }>();
    for (const attempt of [...attempts].reverse()) {
      const stat = map.get(attempt.questionId) ?? { total: 0, correct: 0 };
      stat.total += 1;
      if (attempt.correct) stat.correct += 1;
      stat.last = attempt;
      map.set(attempt.questionId, stat);
    }
    return map;
  }, [attempts]);

  const showMain = (nextTab: Tab = tab) => { setTab(nextTab); setScreen("main"); };

  async function addCategory(name: string) {
    const clean = name.trim();
    if (!clean) return;
    await db.categories.add({ id: crypto.randomUUID(), name: clean, color: colors[categories.length % colors.length], createdAt: new Date().toISOString() });
    await refresh();
    setToast("カテゴリを追加しました");
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`「${category.name}」と、その中の問題を削除しますか？`)) return;
    const ids = await db.questions.where("categoryId").equals(category.id).primaryKeys();
    await db.transaction("rw", db.categories, db.questions, db.attempts, async () => {
      await db.categories.delete(category.id);
      await db.questions.bulkDelete(ids);
      for (const id of ids) await db.attempts.where("questionId").equals(id).delete();
    });
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

  const filteredQuestions = selectedCategory === "all" ? questions : questions.filter((q) => q.categoryId === selectedCategory);
  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? "未分類";

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => showMain("home")} aria-label="ホームへ">
          <span className="brand-mark">M</span><span>ManaBloom<small>自分でつくる学習帳</small></span>
        </button>
        <span className="offline-pill"><i /> この端末に保存</span>
      </header>

      {screen === "main" && tab === "home" && (
        <Home questions={questions} attempts={attempts} sessions={sessions} statsByQuestion={statsByQuestion}
          onStudy={() => setScreen("study-setup")} onCreate={() => openQuestionForm()} onReview={() => { setSelectedCategory("all"); setScreen("study-setup"); }} />
      )}
      {screen === "main" && tab === "library" && (
        <Library categories={categories} questions={filteredQuestions} selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory} categoryName={categoryName} statsByQuestion={statsByQuestion}
          onAddCategory={addCategory} onDeleteCategory={deleteCategory} onCreate={() => openQuestionForm()}
          onEdit={openQuestionForm} onDelete={deleteQuestion} />
      )}
      {screen === "main" && tab === "history" && <History attempts={attempts} sessions={sessions} questions={questions} />}
      {screen === "main" && tab === "settings" && <Settings />}
      {screen === "question-form" && <QuestionForm categories={categories} question={editingQuestion} onCancel={() => showMain("library")}
        onSaved={async () => { await refresh(); showMain("library"); setToast(editingQuestion ? "問題を更新しました" : "問題を作成しました"); }} />}
      {screen === "study-setup" && <StudySetup questions={questions} categories={categories} attempts={attempts}
        onCancel={() => showMain("home")} onStart={(items, seconds) => {
          setQuizQuestions(items); setQuizIndex(0); setQuizAnswers([]); setCurrentAnswer(""); setLetterAnswer("");
          const now = Date.now();
          setTimeLimit(seconds); setRemaining(seconds); setSessionId(crypto.randomUUID()); setStartedAt(now); setSessionStartedAt(now); setScreen("quiz");
        }} />}
      {screen === "quiz" && quizQuestions[quizIndex] && (
        <Quiz question={quizQuestions[quizIndex]} index={quizIndex} total={quizQuestions.length} answer={currentAnswer}
          letterAnswer={letterAnswer} remaining={remaining} timeLimit={timeLimit} category={categoryName(quizQuestions[quizIndex].categoryId)}
          onAnswer={setCurrentAnswer} onLetter={setLetterAnswer} onSubmit={() => void submitAnswer()} onQuit={() => { if (window.confirm("学習を終了しますか？")) showMain("home"); }} />
      )}
      {screen === "result" && <Result answers={quizAnswers} onHome={() => showMain("home")} onRetry={() => setScreen("study-setup")} />}

      {screen === "main" && (
        <nav className="bottom-nav" aria-label="メインメニュー">
          <NavButton active={tab === "home"} icon="⌂" label="ホーム" onClick={() => showMain("home")} />
          <NavButton active={tab === "library"} icon="▤" label="問題" onClick={() => showMain("library")} />
          <NavButton active={tab === "history"} icon="◷" label="履歴" onClick={() => showMain("history")} />
          <NavButton active={tab === "settings"} icon="⚙" label="設定" onClick={() => showMain("settings")} />
        </nav>
      )}
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}

function Home({ questions, attempts, sessions, statsByQuestion, onStudy, onCreate, onReview }: {
  questions: Question[]; attempts: Attempt[]; sessions: StudySession[];
  statsByQuestion: Map<string, { total: number; correct: number; last?: Attempt }>;
  onStudy: () => void; onCreate: () => void; onReview: () => void;
}) {
  const weak = questions.filter((q) => { const s = statsByQuestion.get(q.id); return s && s.total > 0 && s.correct / s.total < .6; }).length;
  const answeredToday = attempts.filter((a) => new Date(a.answeredAt).toDateString() === new Date().toDateString()).length;
  const latest = sessions[0];
  return <section className="page home-page">
    <div className="hero">
      <div><p className="eyebrow">今日も、ひとつずつ。</p><h1>覚えたいことを、<br /><em>自分の問題</em>にしよう。</h1><p>問題をつくる。解いてみる。間違いをもう一度。<br />あなた専用の学習帳です。</p></div>
      <div className="hero-orbit"><span>?</span><i>ABC</i><b>○×</b></div>
    </div>
    <div className="quick-grid">
      <button className="quick-card primary" onClick={onStudy}><span className="quick-icon">▶</span><div><small>すぐに始める</small><strong>問題を解く</strong><p>{questions.length ? `${questions.length}問から出題できます` : "まずは問題を作りましょう"}</p></div><b>→</b></button>
      <button className="quick-card" onClick={onCreate}><span className="quick-icon amber">＋</span><div><small>かんたん登録</small><strong>問題をつくる</strong><p>3つの回答形式に対応</p></div><b>→</b></button>
      <button className="quick-card" onClick={onReview}><span className="quick-icon coral">↻</span><div><small>苦手を克服</small><strong>まちがい復習</strong><p>{weak ? `苦手な問題が${weak}問あります` : "学習すると苦手が見つかります"}</p></div><b>→</b></button>
    </div>
    <div className="section-heading"><div><span className="tiny-line" /><h2>今日の学習</h2></div><span>{new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date())}</span></div>
    <div className="stats-row">
      <article className="stat-card"><small>今日解いた問題</small><strong>{answeredToday}<i>問</i></strong><span>{answeredToday ? "いいペースです" : "最初の一問を始めよう"}</span></article>
      <article className="stat-card"><small>前回の正答率</small><strong>{latest ? Math.round(latest.correct / latest.total * 100) : 0}<i>%</i></strong><span>{latest ? `${latest.correct} / ${latest.total}問 正解` : "まだ記録がありません"}</span></article>
      <article className="stat-card accent"><small>登録した問題</small><strong>{questions.length}<i>問</i></strong><span>端末内に保存中</span></article>
    </div>
  </section>;
}

function Library({ categories, questions, selectedCategory, onSelectCategory, categoryName, statsByQuestion, onAddCategory, onDeleteCategory, onCreate, onEdit, onDelete }: {
  categories: Category[]; questions: Question[]; selectedCategory: string; onSelectCategory: (id: string) => void;
  categoryName: (id: string) => string; statsByQuestion: Map<string, { total: number; correct: number; last?: Attempt }>;
  onAddCategory: (name: string) => void; onDeleteCategory: (category: Category) => void; onCreate: () => void;
  onEdit: (q: Question) => void; onDelete: (q: Question) => void;
}) {
  const [adding, setAdding] = useState(false); const [name, setName] = useState("");
  return <section className="page"><div className="page-title"><div><p className="eyebrow">MY QUESTIONS</p><h1>問題ライブラリ</h1><p>カテゴリで整理して、いつでも学習できます。</p></div><button className="button primary-button" onClick={onCreate}>＋ 問題をつくる</button></div>
    <div className="category-strip"><button className={selectedCategory === "all" ? "category-chip active" : "category-chip"} onClick={() => onSelectCategory("all")}><i style={{ background: "#333" }} />すべて</button>
      {categories.map((category) => <div className="category-wrap" key={category.id}><button className={selectedCategory === category.id ? "category-chip active" : "category-chip"} onClick={() => onSelectCategory(category.id)}><i style={{ background: category.color }} />{category.name}</button><button className="chip-delete" aria-label={`${category.name}を削除`} onClick={() => onDeleteCategory(category)}>×</button></div>)}
      {adding ? <form className="category-add" onSubmit={(e) => { e.preventDefault(); onAddCategory(name); setName(""); setAdding(false); }}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="カテゴリ名" aria-label="新しいカテゴリ名" /><button>追加</button></form> : <button className="category-chip add" onClick={() => setAdding(true)}>＋ カテゴリ</button>}
    </div>
    {questions.length === 0 ? <div className="empty-state"><span>✎</span><h2>まだ問題がありません</h2><p>覚えたいことを、最初の問題にしてみましょう。</p><button className="button primary-button" onClick={onCreate}>最初の問題をつくる</button></div> :
      <div className="question-list">{questions.map((question) => { const stat = statsByQuestion.get(question.id); return <article className="question-row" key={question.id}><div className="answer-type">{question.answerType === "boolean" ? "○×" : question.answerType === "letters" ? "4択" : "入力"}</div><div className="question-copy"><div><span>{categoryName(question.categoryId)}</span><small>{answerLabels[question.answerType]}</small></div><h3>{question.prompt}</h3><p>答え：{question.answer}</p></div><div className="question-stat">{stat ? <><strong>{Math.round(stat.correct / stat.total * 100)}%</strong><small>{stat.total}回答</small></> : <small>未回答</small>}</div><div className="row-actions"><button onClick={() => onEdit(question)}>編集</button><button className="danger-link" onClick={() => onDelete(question)}>削除</button></div></article>; })}</div>}
  </section>;
}

function QuestionForm({ categories, question, onCancel, onSaved }: { categories: Category[]; question: Question | null; onCancel: () => void; onSaved: () => void }) {
  const [prompt, setPrompt] = useState(question?.prompt ?? ""); const [answer, setAnswer] = useState(question?.answer ?? "");
  const [categoryId, setCategoryId] = useState(question?.categoryId ?? categories[0]?.id ?? ""); const [answerType, setAnswerType] = useState<AnswerType>(question?.answerType ?? "text");
  async function save(e: FormEvent) { e.preventDefault(); const now = new Date().toISOString(); const item: Question = { id: question?.id ?? crypto.randomUUID(), prompt: prompt.trim(), answer: answer.trim(), categoryId, answerType, createdAt: question?.createdAt ?? now, updatedAt: now }; await db.questions.put(item); onSaved(); }
  return <section className="page form-page"><button className="back-link" onClick={onCancel}>← 問題一覧に戻る</button><div className="form-heading"><p className="eyebrow">CREATE QUESTION</p><h1>{question ? "問題を編集" : "新しい問題をつくる"}</h1><p>あとで自分が迷わない、シンプルな問題がおすすめです。</p></div>
    <form className="editor-card" onSubmit={save}><label>カテゴリ<select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <fieldset><legend>回答方式</legend><div className="type-grid">{(["text", "letters", "boolean"] as AnswerType[]).map((type) => <button type="button" key={type} className={answerType === type ? "type-card active" : "type-card"} onClick={() => { setAnswerType(type); setAnswer(""); }}><span>{type === "text" ? "Aa" : type === "letters" ? "A B C" : "○ ×"}</span><strong>{answerLabels[type]}</strong><small>{type === "text" ? "答えを直接入力" : type === "letters" ? "1文字ずつ選ぶ" : "正しいか間違いか"}</small></button>)}<button type="button" className="type-card disabled" disabled><span>∑</span><strong>数式・関数</strong><small>リリース検討中</small></button></div></fieldset>
      <label>問題文<textarea required rows={4} value={prompt} maxLength={500} onChange={(e) => setPrompt(e.target.value)} placeholder="例：日本の首都はどこ？" /><small className="counter">{prompt.length} / 500</small></label>
      {answerType === "boolean" ? <fieldset><legend>正解</legend><div className="boolean-select"><button type="button" className={answer === "○" ? "active" : ""} onClick={() => setAnswer("○")}>○<small>正しい</small></button><button type="button" className={answer === "×" ? "active" : ""} onClick={() => setAnswer("×")}>×<small>間違い</small></button></div></fieldset> : <label>正解<input required value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={answerType === "letters" ? "例：APPLE" : "例：東京"} /><small>正誤は文字の完全一致で判定します。</small></label>}
      <div className="future-note"><span>▧</span><div><strong>画像の添付</strong><p>リリースを検討している機能です。現在はご利用いただけません。</p></div></div>
      <div className="form-actions"><button type="button" className="button ghost-button" onClick={onCancel}>キャンセル</button><button className="button primary-button" disabled={!prompt.trim() || !answer.trim() || !categoryId}>{question ? "変更を保存" : "問題を保存"}</button></div>
    </form></section>;
}

function StudySetup({ questions, categories, attempts, onCancel, onStart }: { questions: Question[]; categories: Category[]; attempts: Attempt[]; onCancel: () => void; onStart: (q: Question[], seconds: number) => void }) {
  const [categoryId, setCategoryId] = useState("all"); const [count, setCount] = useState(10); const [limit, setLimit] = useState(0); const [filter, setFilter] = useState<Filter>("all");
  const available = useMemo(() => questions.filter((q) => categoryId === "all" || q.categoryId === categoryId).filter((q) => {
    const own = attempts.filter((a) => a.questionId === q.id); const last = own[0];
    if (filter === "last-wrong") return !!last && !last.correct;
    if (filter === "ever-wrong") return own.some((a) => !a.correct);
    if (filter === "unanswered") return own.length === 0;
    if (filter === "weak") return own.length > 0 && own.filter((a) => a.correct).length / own.length < .6;
    return true;
  }), [attempts, categoryId, filter, questions]);
  return <section className="page setup-page"><button className="back-link" onClick={onCancel}>← ホームに戻る</button><div className="form-heading"><p className="eyebrow">STUDY SETUP</p><h1>どんなふうに解きますか？</h1><p>今日の気分に合わせて、出題内容を選びましょう。</p></div>
    <div className="setup-card"><label>カテゴリ<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="all">すべてのカテゴリ</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <fieldset><legend>出題範囲</legend><div className="segmented">{([['all','すべて'],['last-wrong','前回不正解'],['ever-wrong','不正解あり'],['unanswered','未回答'],['weak','苦手']] as [Filter,string][]).map(([value, label]) => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div></fieldset>
      <fieldset><legend>出題数</legend><div className="option-row">{[5,10,20,9999].map((value) => <button type="button" key={value} className={count === value ? "active" : ""} onClick={() => setCount(value)}>{value === 9999 ? "全問" : `${value}問`}</button>)}</div></fieldset>
      <fieldset><legend>1問の制限時間</legend><div className="option-row">{[[0,"なし"],[10,"10秒"],[30,"30秒"],[60,"60秒"]].map(([value,label]) => <button type="button" key={value} className={limit === value ? "active" : ""} onClick={() => setLimit(value as number)}>{label}</button>)}</div></fieldset>
      <div className="setup-summary"><span>{available.length}</span><p>問が条件に合っています<br /><small>出題順はランダムです</small></p><button className="button primary-button" disabled={!available.length} onClick={() => onStart(shuffle(available).slice(0, count), limit)}>学習を始める →</button></div>
    </div></section>;
}

function Quiz({ question, index, total, answer, letterAnswer, remaining, timeLimit, category, onAnswer, onLetter, onSubmit, onQuit }: { question: Question; index: number; total: number; answer: string; letterAnswer: string; remaining: number; timeLimit: number; category: string; onAnswer: (s: string) => void; onLetter: (s: string) => void; onSubmit: () => void; onQuit: () => void }) {
  const choices = useMemo(() => makeLetterChoices(question.answer, letterAnswer.length), [letterAnswer.length, question.answer]);
  const complete = question.answerType === "letters" ? letterAnswer.length === question.answer.length : answer.trim().length > 0;
  return <section className="quiz-page"><div className="quiz-top"><button onClick={onQuit}>× 終了</button><span>{category}</span><strong>{index + 1}<small> / {total}</small></strong></div><div className="progress"><i style={{ width: `${(index + 1) / total * 100}%` }} /></div>
    <div className="quiz-content"><div className="quiz-meta"><span>QUESTION {String(index + 1).padStart(2,"0")}</span>{timeLimit > 0 && <b className={remaining <= 5 ? "urgent" : ""}>◷ {remaining}秒</b>}</div><h1>{question.prompt}</h1>
      {question.answerType === "text" && <div className="answer-area"><label>答えを入力<input value={answer} onChange={(e) => onAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && answer.trim()) onSubmit(); }} placeholder="ここに答えを入力" /></label></div>}
      {question.answerType === "boolean" && <div className="boolean-answer"><button className={answer === "○" ? "active" : ""} onClick={() => onAnswer("○")}>○<span>正しい</span></button><button className={answer === "×" ? "active" : ""} onClick={() => onAnswer("×")}>×<span>間違い</span></button></div>}
      {question.answerType === "letters" && <div className="letters-area"><div className="letter-slots">{[...question.answer].map((_, i) => <span key={i} className={i < letterAnswer.length ? "filled" : i === letterAnswer.length ? "current" : ""}>{letterAnswer[i] ?? ""}</span>)}</div>{letterAnswer.length < question.answer.length ? <div className="letter-choices">{choices.map((choice) => <button key={choice} onClick={() => onLetter(letterAnswer + choice)}>{choice}</button>)}</div> : <button className="text-link" onClick={() => onLetter("")}>選び直す</button>}</div>}
      <button className="button primary-button answer-submit" disabled={!complete} onClick={onSubmit}>回答する</button>
    </div></section>;
}

function Result({ answers, onHome, onRetry }: { answers: { question: Question; answer: string; correct: boolean }[]; onHome: () => void; onRetry: () => void }) {
  const correct = answers.filter((a) => a.correct).length; const percent = Math.round(correct / answers.length * 100);
  return <section className="page result-page"><div className="result-hero"><p className="eyebrow">SESSION COMPLETE</p><h1>{percent >= 80 ? "すばらしい結果です！" : percent >= 50 ? "あと少し、伸びています。" : "間違いは、覚えるチャンス。"}</h1><div className="score-ring"><strong>{percent}</strong><span>%</span></div><p>{answers.length}問中 <b>{correct}問</b> 正解</p></div>
    <div className="result-list"><h2>回答のふりかえり</h2>{answers.map((item, i) => <article key={item.question.id}><span className={item.correct ? "correct" : "wrong"}>{item.correct ? "✓" : "×"}</span><div><small>Q{i+1}</small><h3>{item.question.prompt}</h3>{!item.correct && <p>あなた：{item.answer || "未回答"} / 正解：<b>{item.question.answer}</b></p>}</div></article>)}</div>
    <div className="result-actions"><button className="button ghost-button" onClick={onHome}>ホームへ</button><button className="button primary-button" onClick={onRetry}>もう一度学習する</button></div></section>;
}

function History({ attempts, sessions, questions }: { attempts: Attempt[]; sessions: StudySession[]; questions: Question[] }) {
  const questionName = (id: string) => questions.find((q) => q.id === id)?.prompt ?? "削除済みの問題";
  const totalCorrect = attempts.filter((a) => a.correct).length;
  return <section className="page"><div className="page-title"><div><p className="eyebrow">LEARNING LOG</p><h1>学習のきろく</h1><p>積み重ねた回答と、これまでの成長。</p></div></div>
    <div className="history-summary"><article><small>これまでの回答</small><strong>{attempts.length}<i>問</i></strong></article><article><small>全体の正答率</small><strong>{attempts.length ? Math.round(totalCorrect / attempts.length * 100) : 0}<i>%</i></strong></article><article><small>学習した回数</small><strong>{sessions.length}<i>回</i></strong></article></div>
    <div className="section-heading"><div><span className="tiny-line" /><h2>最近の回答</h2></div></div>
    {attempts.length === 0 ? <div className="empty-state compact"><span>◷</span><h2>まだ履歴がありません</h2><p>問題を解くと、ここに記録されます。</p></div> : <div className="attempt-list">{attempts.slice(0,20).map((a) => <article key={a.id}><span className={a.correct ? "correct" : "wrong"}>{a.correct ? "✓" : "×"}</span><div><h3>{questionName(a.questionId)}</h3><p>{new Intl.DateTimeFormat("ja-JP", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(a.answeredAt))} ・ 回答「{a.answer || "未回答"}」</p></div></article>)}</div>}
  </section>;
}

function Settings() { return <section className="page"><div className="page-title"><div><p className="eyebrow">SETTINGS</p><h1>設定</h1><p>このアプリとデータについて。</p></div></div><div className="settings-grid"><article><span>▣</span><div><h2>データの保存先</h2><p>カテゴリ・問題・回答履歴は、この端末のブラウザ内に保存されています。サーバーへの送信は行いません。</p><small>ブラウザのデータを削除すると、学習データも消去されます。</small></div></article><article className="future"><span>∑</span><div><h2>数式・関数入力 <b>リリース検討中</b></h2><p>数学・物理・化学向けの専用入力機能を検討しています。</p></div></article><article className="future"><span>▧</span><div><h2>画像の添付 <b>リリース検討中</b></h2><p>問題文や答えへの画像添付機能を検討しています。</p></div></article></div></section>; }

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) { return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span>{label}</button>; }
