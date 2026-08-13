"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createBackup, db, initializeDatabase, parseBackup, restoreBackup, type AnswerType, type Attempt, type Category, type ManaBloomBackup, type Question, type StudySession } from "./db";

type Tab = "home" | "library" | "history" | "settings";
type Screen = "main" | "question-form" | "study-setup" | "quiz" | "result";
type Filter = "all" | "last-wrong" | "ever-wrong" | "unanswered" | "weak";
type QuizAnswer = { question: Question; answer: string; correct: boolean };

const colors = ["#557c6b", "#e9a23b", "#cf705c", "#6b7da8", "#8b77a8"];
const answerLabels: Record<AnswerType, string> = { text: "フリー入力", letters: "一文字ずつ4択", boolean: "○×問題", "multiple-choice": "択数回答" };

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

function questionTextSize(prompt: string) {
  const characterCount = [...prompt.replace(/\s/g, "")].length;
  const lineBreakWeight = Math.max(0, prompt.split("\n").length - 1) * 20;
  const length = characterCount + lineBreakWeight;
  if (length > 180) return "question-text-xlong";
  if (length > 100) return "question-text-long";
  if (length > 50) return "question-text-medium";
  return "question-text-short";
}

function truncateQuestionPrompt(prompt: string, maxFullWidthCharacters = 20) {
  const characters = [...prompt];
  let width = 0;
  let end = 0;
  for (const character of characters) {
    const characterWidth = /^[\u0020-\u007e\uff61-\uff9f]$/.test(character) ? 0.5 : 1;
    if (width + characterWidth > maxFullWidthCharacters) break;
    width += characterWidth;
    end += 1;
  }
  return end < characters.length ? `${characters.slice(0, end).join("")}...` : prompt;
}

function makeLetterChoices(answer: string, index: number) {
  const right = answer[index];
  const hiragana = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉゃゅょっ";
  const katakana = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォャュョッー";
  const kanji = "一二三四五六七八九十百千万上下左右大小中年月日時分人男女子先生学校国語数学英理科社会山川田空天気雨雪花草木林森火水土金本文字名前東西南北入口出口車電力音食飲見聞読書話言行来帰高低長短新古多少白黒赤青春夏秋冬朝昼夜海島町村市道家室友父母兄弟姉妹魚鳥犬猫牛馬";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const fullwidthUppercase = "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ";
  const fullwidthLowercase = "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ";
  const digits = "0123456789";
  const fullwidthDigits = "０１２３４５６７８９";
  const symbols = "＋－×÷＝！？・、。．，：；〜ー+-*/=!?.,:;<>（）()「」『』【】[]";
  let pool: string;
  if (/^[\u3040-\u309f]$/.test(right)) pool = hiragana;
  else if (/^[\u30a0-\u30ff]$/.test(right)) pool = katakana;
  else if (/^[\u3400-\u9fff]$/.test(right)) pool = kanji;
  else if (/^[A-Z]$/.test(right)) pool = uppercase;
  else if (/^[a-z]$/.test(right)) pool = lowercase;
  else if (/^[Ａ-Ｚ]$/.test(right)) pool = fullwidthUppercase;
  else if (/^[ａ-ｚ]$/.test(right)) pool = fullwidthLowercase;
  else if (/^[0-9]$/.test(right)) pool = digits;
  else if (/^[０-９]$/.test(right)) pool = fullwidthDigits;
  else pool = symbols;
  const candidates = [...new Set([...pool].filter((letter) => letter !== right))];
  const fallback = [...new Set([...hiragana, ...katakana, ...uppercase, ...digits].filter((letter) => letter !== right && !candidates.includes(letter)))];
  const wrong = shuffle(candidates.length >= 3 ? candidates : [...candidates, ...fallback]).slice(0, 3);
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
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [feedback, setFeedback] = useState<QuizAnswer | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [letterAnswer, setLetterAnswer] = useState("");
  const [timeLimit, setTimeLimit] = useState(0);
  const [timeLimitOptions, setTimeLimitOptions] = useState<number[]>([10, 30, 60]);
  const [remaining, setRemaining] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState(0);

  const refresh = useCallback(async () => {
    const [nextCategories, nextQuestions, nextAttempts, nextSessions, timeSettings] = await Promise.all([
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
    if (!isNativeApp && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.querySelector<HTMLElement>(".app-content")?.scrollTo(0, 0);
  }, [quizIndex, screen, tab]);

  const submitAnswer = useCallback(async (forcedAnswer?: string) => {
    if (feedback) return;
    const question = quizQuestions[quizIndex];
    if (!question) return;
    const answer = forcedAnswer ?? (question.answerType === "letters" ? letterAnswer : currentAnswer);
    const correct = answer === question.answer;
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    const result = { question, answer, correct };
    const nextAnswers = [...quizAnswers, result];
    setFeedback(result);
    setFeedbackSaved(false);
    setQuizAnswers(nextAnswers);
    await db.attempts.add({
      id: crypto.randomUUID(), questionId: question.id, answer, correct,
      answeredAt: new Date().toISOString(), elapsedSeconds, sessionId,
    });
    setFeedbackSaved(true);
  }, [currentAnswer, feedback, letterAnswer, quizAnswers, quizIndex, quizQuestions, sessionId, startedAt]);

  const continueQuiz = useCallback(async () => {
    if (!feedback || !feedbackSaved) return;
    if (quizIndex + 1 >= quizQuestions.length) {
      await db.sessions.add({
        id: sessionId, startedAt: new Date(sessionStartedAt).toISOString(),
        finishedAt: new Date().toISOString(), total: quizAnswers.length,
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
  }, [feedback, feedbackSaved, quizAnswers, quizIndex, quizQuestions.length, refresh, sessionId, sessionStartedAt, timeLimit]);

  useEffect(() => {
    if (screen !== "quiz" || timeLimit === 0 || feedback) return;
    const timer = window.setTimeout(() => {
      if (remaining <= 1) void submitAnswer("");
      else setRemaining((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [feedback, remaining, screen, submitAnswer, timeLimit]);

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

  const showMain = (nextTab: Tab = tab) => {
    if (nextTab === "library") setSelectedCategory("all");
    setTab(nextTab);
    setScreen("main");
  };

  async function addCategory(name: string) {
    const clean = name.trim();
    if (!clean) return;
    await db.categories.add({ id: crypto.randomUUID(), name: clean, color: colors[categories.length % colors.length], createdAt: new Date().toISOString() });
    await refresh();
    setToast("カテゴリを追加しました");
  }

  async function updateTimeLimitOptions(options: number[]) {
    const normalized = [...new Set(options.filter((value) => Number.isInteger(value) && value > 0 && value <= 3600))].sort((a, b) => a - b);
    await db.settings.put({ key: "timeLimits", numericValues: normalized });
    setTimeLimitOptions(normalized);
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

  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? "未分類";

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => showMain("home")} aria-label="ホームへ">
          <span className="brand-mark">M</span><span>ManaBloom<small>自分でつくる学習帳</small></span>
        </button>
        <span className="offline-pill"><i /> この端末に保存</span>
      </header>

      <div className="app-content">
      {screen === "main" && tab === "home" && (
        <Home questions={questions} attempts={attempts} sessions={sessions}
          onStudy={() => setScreen("study-setup")} onCreate={() => openQuestionForm()} onList={() => showMain("library")} />
      )}
      {screen === "main" && tab === "library" && (
        <Library categories={categories} questions={questions} selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory} categoryName={categoryName} statsByQuestion={statsByQuestion}
          onAddCategory={addCategory} onDeleteCategory={deleteCategory} onCreate={() => openQuestionForm()}
          onEdit={openQuestionForm} onDelete={deleteQuestion} />
      )}
      {screen === "main" && tab === "history" && <History attempts={attempts} sessions={sessions} questions={questions} onEdit={openQuestionForm} />}
      {screen === "main" && tab === "settings" && <Settings onRestored={async () => { await refresh(); setToast("バックアップを復元しました"); }} />}
      {screen === "question-form" && <QuestionForm categories={categories} question={editingQuestion} onCancel={() => showMain(editingQuestion ? "library" : "home")}
        onSaved={async () => { await refresh(); showMain("library"); setToast(editingQuestion ? "問題を更新しました" : "問題を作成しました"); }} />}
      {screen === "study-setup" && <StudySetup questions={questions} categories={categories} attempts={attempts} timeLimitOptions={timeLimitOptions} onUpdateTimeLimits={(options) => void updateTimeLimitOptions(options)}
        onCancel={() => showMain("home")} onStart={(items, seconds) => {
          setQuizQuestions(items); setQuizIndex(0); setQuizAnswers([]); setFeedback(null); setFeedbackSaved(false); setCurrentAnswer(""); setLetterAnswer("");
          const now = Date.now();
          setTimeLimit(seconds); setRemaining(seconds); setSessionId(crypto.randomUUID()); setStartedAt(now); setSessionStartedAt(now); setScreen("quiz");
        }} />}
      {screen === "quiz" && quizQuestions[quizIndex] && (
        <Quiz question={quizQuestions[quizIndex]} index={quizIndex} total={quizQuestions.length} answer={currentAnswer}
          letterAnswer={letterAnswer} remaining={remaining} timeLimit={timeLimit} category={categoryName(quizQuestions[quizIndex].categoryId)}
          feedback={feedback} feedbackSaved={feedbackSaved} onAnswer={setCurrentAnswer} onLetter={setLetterAnswer} onSubmit={(forcedAnswer) => void submitAnswer(forcedAnswer)} onContinue={() => void continueQuiz()} onQuit={() => { if (window.confirm("学習を終了しますか？")) showMain("home"); }} />
      )}
      {screen === "result" && <Result answers={quizAnswers} onHome={() => showMain("home")} onRetry={() => setScreen("study-setup")} />}
      </div>

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

function Home({ questions, attempts, sessions, onStudy, onCreate, onList }: {
  questions: Question[]; attempts: Attempt[]; sessions: StudySession[];
  onStudy: () => void; onCreate: () => void; onList: () => void;
}) {
  const answeredToday = attempts.filter((a) => new Date(a.answeredAt).toDateString() === new Date().toDateString()).length;
  const latest = sessions[0];
  return <section className="page home-page">
    <div className="hero">
      <div><p className="eyebrow">今日も、ひとつずつ。</p><h1>覚えたいことを、<br /><em>自分の問題</em>にしよう。</h1><p>問題をつくる。解いてみる。間違いをもう一度。<br />あなた専用の学習帳です。</p></div>
      <div className="hero-orbit"><span>?</span><i>ABC</i><b>○×</b></div>
    </div>
    <div className="quick-grid">
      <button className="quick-card primary" onClick={onStudy}><span className="quick-icon">▶</span><div><small>すぐに始める</small><strong>問題を解く</strong><p>{questions.length ? `${questions.length}問から出題できます` : "まずは問題を作りましょう"}</p></div><b>→</b></button>
      <button className="quick-card" onClick={onCreate}><span className="quick-icon amber">＋</span><div><small>かんたん登録</small><strong>問題をつくる</strong><p>4つの回答形式に対応</p></div><b>→</b></button>
      <button className="quick-card" onClick={onList}><span className="quick-icon violet">▤</span><div><small>登録内容を確認</small><strong>問題一覧</strong><p>{questions.length ? `${questions.length}問を登録中` : "問題はまだありません"}</p></div><b>→</b></button>
    </div>
    <div className="section-heading"><div><span className="tiny-line" /><h2>今日の学習</h2></div><span>{new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date())}</span></div>
    <div className="stats-row">
      <article className="stat-card"><small>今日解いた問題</small><strong>{answeredToday}<i>問</i></strong><span>{answeredToday ? "いいペースです" : "最初の一問を始めよう"}</span></article>
      <article className="stat-card"><small>前回の正答率</small><strong>{latest ? Math.round(latest.correct / latest.total * 100) : 0}<i>%</i></strong><span>{latest ? `${latest.correct} / ${latest.total}問 正解` : "まだ記録がありません"}</span></article>
      <article className="stat-card accent"><small>登録した問題</small><strong>{questions.length}<i>問</i></strong><span>端末内に保存中</span></article>
    </div>
    <aside className="reward-card" aria-label="楽天アフィリエイト広告">
      <div className="reward-copy"><small>広告・PR</small><h2>がんばった自分に、ご褒美はいかがですか？</h2><p>こちらのリンクを経由して購入いただくと、開発者に報酬が入り、ManaBloomを育てる励みになります。</p></div>
      <a href="https://hb.afl.rakuten.co.jp/hsc/568d73c9.aab63da7.564bf542.832cabdd/?link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOiIxMTMiLCJiYW4iOjEyNTE4MjAsImFtcCI6ZmFsc2V9" target="_blank" rel="nofollow sponsored noopener noreferrer"><img src="https://hbb.afl.rakuten.co.jp/hsb/568d73c9.aab63da7.564bf542.832cabdd/?me_id=1&me_adv_id=1251820&t=pict" alt="楽天市場の商品を見る" /></a>
    </aside>
  </section>;
}

function Library({ categories, questions, selectedCategory, onSelectCategory, categoryName, statsByQuestion, onAddCategory, onDeleteCategory, onCreate, onEdit, onDelete }: {
  categories: Category[]; questions: Question[]; selectedCategory: string; onSelectCategory: (id: string) => void;
  categoryName: (id: string) => string; statsByQuestion: Map<string, { total: number; correct: number; last?: Attempt }>;
  onAddCategory: (name: string) => void; onDeleteCategory: (category: Category) => void; onCreate: () => void;
  onEdit: (q: Question) => void; onDelete: (q: Question) => void;
}) {
  const [adding, setAdding] = useState(false); const [name, setName] = useState("");
  const visibleQuestions = selectedCategory === "all" ? questions : questions.filter((question) => question.categoryId === selectedCategory);
  return <section className="page"><div className="page-title"><div><p className="eyebrow">MY QUESTIONS</p><h1>問題ライブラリ</h1><p>カテゴリで整理して、いつでも学習できます。</p></div><button className="button primary-button" onClick={onCreate}>＋ 問題をつくる</button></div>
    <div className="category-strip"><button className={selectedCategory === "all" ? "category-chip active" : "category-chip"} onClick={() => onSelectCategory("all")}><i style={{ background: "#333" }} />すべて</button>
      {categories.map((category) => <div className="category-wrap" key={category.id}><button className={selectedCategory === category.id ? "category-chip active" : "category-chip"} onClick={() => onSelectCategory(category.id)}><i style={{ background: category.color }} />{category.name}</button><button className="chip-delete" aria-label={`${category.name}を削除`} onClick={() => onDeleteCategory(category)}>×</button></div>)}
      {adding ? <form className="category-add" onSubmit={(e) => { e.preventDefault(); onAddCategory(name); setName(""); setAdding(false); }}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="カテゴリ名" aria-label="新しいカテゴリ名" /><button>追加</button></form> : <button className="category-chip add" onClick={() => setAdding(true)}>＋ カテゴリ</button>}
    </div>
    {visibleQuestions.length === 0 ? <div className="empty-state"><span>✎</span><h2>まだ問題がありません</h2><p>覚えたいことを、最初の問題にしてみましょう。</p><button className="button primary-button" onClick={onCreate}>最初の問題をつくる</button></div> :
      <div className="question-list">{visibleQuestions.map((question) => { const stat = statsByQuestion.get(question.id); return <article className="question-row" key={question.id}><div className="answer-type">{question.answerType === "boolean" ? "○×" : question.answerType === "letters" ? "4択" : question.answerType === "multiple-choice" ? `${question.choices?.length ?? 0}択` : "入力"}</div><div className="question-copy"><div><span>{categoryName(question.categoryId)}</span><small>{answerLabels[question.answerType]}</small></div><h3 title={question.prompt}>{truncateQuestionPrompt(question.prompt)}</h3><p>答え：{question.displayAnswer || question.answer}{question.answerType === "letters" && question.displayAnswer !== question.answer ? `（入力：${question.answer}）` : ""}</p></div><div className="question-stat">{stat ? <><strong>{Math.round(stat.correct / stat.total * 100)}%</strong><small>{stat.total}回答</small></> : <small>未回答</small>}</div><div className="row-actions"><button onClick={() => onEdit(question)}>編集</button><button className="danger-link" onClick={() => onDelete(question)}>削除</button></div></article>; })}</div>}
  </section>;
}

function QuestionForm({ categories, question, onCancel, onSaved }: { categories: Category[]; question: Question | null; onCancel: () => void; onSaved: () => void }) {
  const [prompt, setPrompt] = useState(question?.prompt ?? ""); const [answer, setAnswer] = useState(question?.answer ?? "");
  const [displayAnswer, setDisplayAnswer] = useState(question?.displayAnswer ?? question?.answer ?? "");
  const [categoryId, setCategoryId] = useState(question?.categoryId ?? "uncategorized"); const [answerType, setAnswerType] = useState<AnswerType>(question?.answerType ?? "text");
  const [choiceCount, setChoiceCount] = useState(question?.choices?.length ?? 4);
  const [choices, setChoices] = useState<string[]>(question?.choices ?? ["", "", "", ""]);
  const [correctChoiceIndex, setCorrectChoiceIndex] = useState(question?.correctChoiceIndex ?? 0);
  const visibleChoices = choices.slice(0, choiceCount);
  const multipleChoiceValid = visibleChoices.length === choiceCount && visibleChoices.every((choice) => choice.trim()) && new Set(visibleChoices.map((choice) => choice.trim())).size === choiceCount && correctChoiceIndex < choiceCount;
  function changeChoiceCount(count: number) { setChoiceCount(count); setChoices((current) => Array.from({ length: count }, (_, index) => current[index] ?? "")); if (correctChoiceIndex >= count) setCorrectChoiceIndex(0); }
  async function save(e: FormEvent) { e.preventDefault(); const now = new Date().toISOString(); const cleanChoices = visibleChoices.map((choice) => choice.trim()); const savedAnswer = answerType === "multiple-choice" ? cleanChoices[correctChoiceIndex] : answer.trim(); const item: Question = { id: question?.id ?? crypto.randomUUID(), prompt: prompt.trim(), answer: savedAnswer, displayAnswer: answerType === "letters" ? displayAnswer.trim() : savedAnswer, choices: answerType === "multiple-choice" ? cleanChoices : undefined, correctChoiceIndex: answerType === "multiple-choice" ? correctChoiceIndex : undefined, categoryId, answerType, createdAt: question?.createdAt ?? now, updatedAt: now }; await db.questions.put(item); onSaved(); }
  return <section className="page form-page"><button className="back-link" onClick={onCancel}>← {question ? "問題一覧に戻る" : "ホームに戻る"}</button><div className="form-heading"><p className="eyebrow">CREATE QUESTION</p><h1>{question ? "問題を編集" : "新しい問題をつくる"}</h1><p>あとで自分が迷わない、シンプルな問題がおすすめです。</p></div>
    <form className="editor-card" onSubmit={save}><label>カテゴリ<select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="uncategorized">カテゴリなし</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <fieldset><legend>回答方式</legend><div className="type-grid">{(["text", "letters", "boolean", "multiple-choice"] as AnswerType[]).map((type) => <button type="button" key={type} className={answerType === type ? "type-card active" : "type-card"} onClick={() => { setAnswerType(type); setAnswer(""); }}><span>{type === "text" ? "Aa" : type === "letters" ? "A B C" : type === "boolean" ? "○ ×" : "☑"}</span><strong>{answerLabels[type]}</strong><small>{type === "text" ? "答えを直接入力" : type === "letters" ? "1文字ずつ選ぶ" : type === "boolean" ? "正しいか間違いか" : "選択肢から1つ選ぶ"}</small></button>)}</div></fieldset>
      <label>問題文<textarea required rows={4} value={prompt} maxLength={500} onChange={(e) => setPrompt(e.target.value)} placeholder="例：日本の首都はどこ？" /><small className="counter">{prompt.length} / 500</small></label>
      {answerType === "boolean" ? <fieldset><legend>正解</legend><div className="boolean-select"><button type="button" className={answer === "○" ? "active" : ""} onClick={() => setAnswer("○")}>○<small>正しい</small></button><button type="button" className={answer === "×" ? "active" : ""} onClick={() => setAnswer("×")}>×<small>間違い</small></button></div></fieldset> : answerType === "letters" ? <div className="letter-answer-fields"><label>画面に表示する答え<input required value={displayAnswer} onChange={(e) => setDisplayAnswer(e.target.value)} placeholder="例：りんご" /><small>問題一覧や回答結果に表示する答えです。</small></label><label>回答時に入力する答え<input required value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="例：APPLE" /><small>この文字を一文字ずつ4択で入力します。</small></label></div> : answerType === "multiple-choice" ? <fieldset className="choice-editor"><legend>選択肢をつくる</legend><label className="choice-count">何択にしますか？<select value={choiceCount} onChange={(event) => changeChoiceCount(Number(event.target.value))}>{Array.from({ length: 9 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count}択</option>)}</select></label><p className="choice-help">正解にする選択肢の丸を選んでください。</p><div className="choice-inputs">{visibleChoices.map((choice, index) => <div className={correctChoiceIndex === index ? "choice-row correct-choice" : "choice-row"} key={index}><input type="radio" name="correct-choice" checked={correctChoiceIndex === index} onChange={() => setCorrectChoiceIndex(index)} aria-label={`選択肢${index + 1}を正解にする`} /><span>{index + 1}</span><input type="text" required value={choice} onChange={(event) => setChoices((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`選択肢 ${index + 1}`} /></div>)}</div>{visibleChoices.some((choice) => choice.trim()) && new Set(visibleChoices.map((choice) => choice.trim()).filter(Boolean)).size !== visibleChoices.filter((choice) => choice.trim()).length && <small className="form-error">同じ選択肢は重複して登録できません。</small>}</fieldset> : <label>正解<input required value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="例：東京" /><small>正誤は文字の完全一致で判定します。</small></label>}
      <div className="form-actions"><button type="button" className="button ghost-button" onClick={onCancel}>キャンセル</button><button className="button primary-button" disabled={!prompt.trim() || (answerType === "multiple-choice" ? !multipleChoiceValid : !answer.trim()) || (answerType === "letters" && !displayAnswer.trim()) || !categoryId}>{question ? "変更を保存" : "問題を保存"}</button></div>
    </form></section>;
}

function StudySetup({ questions, categories, attempts, timeLimitOptions, onUpdateTimeLimits, onCancel, onStart }: { questions: Question[]; categories: Category[]; attempts: Attempt[]; timeLimitOptions: number[]; onUpdateTimeLimits: (options: number[]) => void; onCancel: () => void; onStart: (q: Question[], seconds: number) => void }) {
  const [categoryId, setCategoryId] = useState("all"); const [count, setCount] = useState(Math.max(1, questions.length)); const [limit, setLimit] = useState(0); const [filter, setFilter] = useState<Filter>("all"); const [newLimit, setNewLimit] = useState("");
  const available = useMemo(() => questions.filter((q) => categoryId === "all" || q.categoryId === categoryId).filter((q) => {
    const own = attempts.filter((a) => a.questionId === q.id); const last = own[0];
    if (filter === "last-wrong") return !!last && !last.correct;
    if (filter === "ever-wrong") return own.some((a) => !a.correct);
    if (filter === "unanswered") return own.length === 0;
    if (filter === "weak") return own.length > 0 && own.filter((a) => a.correct).length / own.length < .6;
    return true;
  }), [attempts, categoryId, filter, questions]);
  return <section className="page setup-page"><button className="back-link" onClick={onCancel}>← ホームに戻る</button><div className="form-heading"><p className="eyebrow">STUDY SETUP</p><h1>どんなふうに解きますか？</h1><p>今日の気分に合わせて、出題内容を選びましょう。</p></div>
    <div className="setup-card"><label>カテゴリ<select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setCount(Math.max(1, questions.filter((question) => e.target.value === "all" || question.categoryId === e.target.value).length)); }}><option value="all">すべてのカテゴリ</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <fieldset><legend>出題範囲</legend><div className="segmented">{([['all','すべて'],['last-wrong','前回不正解'],['ever-wrong','不正解あり'],['unanswered','未回答'],['weak','苦手']] as [Filter,string][]).map(([value, label]) => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => { setFilter(value); setCount(Math.max(1, questions.filter((question) => categoryId === "all" || question.categoryId === categoryId).filter((question) => { const own = attempts.filter((attempt) => attempt.questionId === question.id); const last = own[0]; if (value === "last-wrong") return !!last && !last.correct; if (value === "ever-wrong") return own.some((attempt) => !attempt.correct); if (value === "unanswered") return own.length === 0; if (value === "weak") return own.length > 0 && own.filter((attempt) => attempt.correct).length / own.length < .6; return true; }).length)); }}>{label}</button>)}</div></fieldset>
      <fieldset><legend>出題数 <b className="range-value">{available.length ? Math.min(count, available.length) : 0}問</b></legend><div className="range-control"><input aria-label="出題数" type="range" min="1" max={Math.max(1, available.length)} value={Math.min(count, Math.max(1, available.length))} disabled={!available.length} onChange={(e) => setCount(Number(e.target.value))} /><div><span>1問</span><span>全{available.length}問</span></div></div></fieldset>
      <fieldset><legend>1問の制限時間</legend>{limit === 0 && <p className="field-help">選択されていないため、制限時間なしです。</p>}<div className="time-limit-manager">{timeLimitOptions.map((seconds) => <div className={limit === seconds ? "time-limit-option active" : "time-limit-option"} key={seconds}><button type="button" onClick={() => setLimit(limit === seconds ? 0 : seconds)}>{seconds}秒</button><button type="button" className="remove-time" aria-label={`${seconds}秒を削除`} onClick={() => { if (limit === seconds) setLimit(0); onUpdateTimeLimits(timeLimitOptions.filter((value) => value !== seconds)); }}>×</button></div>)}</div><form className="add-time-form" onSubmit={(event) => { event.preventDefault(); const seconds = Number(newLimit); if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600 || timeLimitOptions.includes(seconds)) return; onUpdateTimeLimits([...timeLimitOptions, seconds]); setLimit(seconds); setNewLimit(""); }}><label>時間を追加<input type="number" min="1" max="3600" step="1" value={newLimit} onChange={(event) => setNewLimit(event.target.value)} placeholder="例：45" /><span>秒</span></label><button type="submit" disabled={!newLimit || timeLimitOptions.includes(Number(newLimit))}>＋ 追加</button></form><small className="field-help">1〜3600秒で追加できます。</small></fieldset>
      <div className="setup-summary"><span>{available.length ? Math.min(count, available.length) : 0}</span><p>問を出題します<br /><small>条件に合う全{available.length}問からランダムです</small></p><button className="button primary-button" disabled={!available.length} onClick={() => onStart(shuffle(available).slice(0, count), limit)}>学習を始める →</button></div>
    </div></section>;
}

function Quiz({ question, index, total, answer, letterAnswer, remaining, timeLimit, category, feedback, feedbackSaved, onAnswer, onLetter, onSubmit, onContinue, onQuit }: { question: Question; index: number; total: number; answer: string; letterAnswer: string; remaining: number; timeLimit: number; category: string; feedback: QuizAnswer | null; feedbackSaved: boolean; onAnswer: (s: string) => void; onLetter: (s: string) => void; onSubmit: (forcedAnswer?: string) => void; onContinue: () => void; onQuit: () => void }) {
  const choices = useMemo(() => makeLetterChoices(question.answer, letterAnswer.length), [letterAnswer.length, question.answer]);
  const complete = answer.trim().length > 0;
  return <section className="quiz-page"><div className="quiz-top"><button onClick={onQuit}>× 終了</button><span>{category}</span><strong>{index + 1}<small> / {total}</small></strong></div><div className="progress"><i style={{ width: `${(index + 1) / total * 100}%` }} /></div>
    <div className="quiz-content"><div className="quiz-meta"><span>QUESTION {String(index + 1).padStart(2,"0")}</span>{timeLimit > 0 && !feedback && <b className={remaining <= 5 ? "urgent" : ""}>◷ {remaining}秒</b>}</div><h1 className={questionTextSize(question.prompt)}>{question.prompt}</h1>
      {feedback ? <div className={feedback.correct ? "instant-feedback correct-feedback" : "instant-feedback wrong-feedback"} role="status" aria-live="assertive"><span className="feedback-mark">{feedback.correct ? "✓" : "×"}</span><h2>{feedback.correct ? "正解です！" : "不正解です"}</h2>{!feedback.correct && <p>あなたの回答：<b>{feedback.answer || "未回答"}</b></p>}<div className="correct-answer"><small>正解</small><strong>{question.displayAnswer || question.answer}</strong>{question.answerType === "letters" && question.displayAnswer !== question.answer && <span>入力する答え：{question.answer}</span>}</div><button className="button primary-button" disabled={!feedbackSaved} onClick={onContinue}>{index + 1 >= total ? "結果を見る" : "次の問題へ"} →</button></div> : <>
        {question.answerType === "text" && <div className="answer-area"><label>答えを入力<input value={answer} onChange={(e) => onAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && answer.trim()) onSubmit(); }} placeholder="ここに答えを入力" /></label></div>}
        {question.answerType === "boolean" && <div className="boolean-answer"><button className={answer === "○" ? "active" : ""} onClick={() => onAnswer("○")}>○<span>正しい</span></button><button className={answer === "×" ? "active" : ""} onClick={() => onAnswer("×")}>×<span>間違い</span></button></div>}
        {question.answerType === "multiple-choice" && <div className="custom-choice-list">{question.choices?.map((choice, choiceIndex) => <button key={choiceIndex} className={answer === choice ? "active" : ""} onClick={() => onAnswer(choice)}><span>{choiceIndex + 1}</span><strong>{choice}</strong><i>{answer === choice ? "✓" : ""}</i></button>)}</div>}
        {question.answerType === "letters" && <div className="letters-area"><div className={letterAnswer ? "selected-letters filled" : "selected-letters"} aria-live="polite">{letterAnswer || <span>文字を選んでください</span>}</div>{letterAnswer.length < question.answer.length ? <div className="letter-choices">{choices.map((choice) => <button key={choice} onClick={() => { const nextAnswer = letterAnswer + choice; onLetter(nextAnswer); if (choice !== question.answer[letterAnswer.length] || nextAnswer.length === question.answer.length) onSubmit(nextAnswer); }}>{choice}</button>)}</div> : null}</div>}
        {question.answerType !== "letters" && <button className="button primary-button answer-submit" disabled={!complete} onClick={() => onSubmit()}>回答する</button>}
      </>}
    </div></section>;
}

function Result({ answers, onHome, onRetry }: { answers: { question: Question; answer: string; correct: boolean }[]; onHome: () => void; onRetry: () => void }) {
  const correct = answers.filter((a) => a.correct).length; const percent = Math.round(correct / answers.length * 100);
  return <section className="page result-page"><div className="result-hero"><p className="eyebrow">SESSION COMPLETE</p><h1>{percent >= 80 ? "すばらしい結果です！" : percent >= 50 ? "あと少し、伸びています。" : "間違いは、覚えるチャンス。"}</h1><div className="score-ring" style={{ background: `conic-gradient(var(--green) ${percent}%, #dfe9df ${percent}% 100%)` }}><strong>{percent}</strong><span>%</span></div><p>{answers.length}問中 <b>{correct}問</b> 正解</p></div>
    <div className="result-list"><h2>回答のふりかえり</h2>{answers.map((item, i) => <article key={item.question.id}><span className={item.correct ? "correct" : "wrong"}>{item.correct ? "✓" : "×"}</span><div><small>Q{i+1}</small><h3>{item.question.prompt}</h3>{!item.correct && <p>あなた：{item.answer || "未回答"} / 正解：<b>{item.question.displayAnswer || item.question.answer}</b>{item.question.answerType === "letters" && item.question.displayAnswer !== item.question.answer ? `（入力：${item.question.answer}）` : ""}</p>}</div></article>)}</div>
    <div className="result-actions"><button className="button ghost-button" onClick={onHome}>ホームへ</button><button className="button primary-button" onClick={onRetry}>もう一度学習する</button></div></section>;
}

function History({ attempts, sessions, questions, onEdit }: { attempts: Attempt[]; sessions: StudySession[]; questions: Question[]; onEdit: (question: Question) => void }) {
  const [view, setView] = useState<"daily" | "all">("daily");
  const [selectedDate, setSelectedDate] = useState("");
  const questionName = (id: string) => questions.find((q) => q.id === id)?.prompt ?? "削除済みの問題";
  const questionLink = (id: string) => {
    const question = questions.find((item) => item.id === id);
    return question ? <button className="history-question-link" onClick={() => onEdit(question)}><span>{question.prompt}</span><small>編集 →</small></button> : <h3>{questionName(id)}</h3>;
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
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const prefix = sameDay(date, today) ? "今日・" : sameDay(date, yesterday) ? "昨日・" : "";
    return prefix + new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(date);
  };
  const visibleDailyGroups = selectedDate ? dailyGroups.filter(([date]) => date === selectedDate) : dailyGroups;
  return <section className="page"><div className="page-title"><div><p className="eyebrow">LEARNING LOG</p><h1>学習のきろく</h1><p>積み重ねた回答と、これまでの成長。</p></div></div>
    <div className="history-summary"><article><small>これまでの回答</small><strong>{attempts.length}<i>問</i></strong></article><article><small>全体の正答率</small><strong>{attempts.length ? Math.round(totalCorrect / attempts.length * 100) : 0}<i>%</i></strong></article><article><small>学習した回数</small><strong>{sessions.length}<i>回</i></strong></article></div>
    <div className="history-toolbar"><div><span className="tiny-line" /><h2>{view === "daily" ? "日付ごとの学習" : "すべての回答"}</h2></div><div className="history-tabs"><button className={view === "daily" ? "active" : ""} onClick={() => setView("daily")}>日付ごと</button><button className={view === "all" ? "active" : ""} onClick={() => setView("all")}>回答一覧</button></div></div>
    {view === "daily" && attempts.length > 0 && <div className="date-picker"><label>表示する日付<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><button disabled={!selectedDate} onClick={() => setSelectedDate("")}>すべての日付</button></div>}
    {attempts.length === 0 ? <div className="empty-state compact"><span>◷</span><h2>まだ履歴がありません</h2><p>問題を解くと、ここに記録されます。</p></div> : view === "daily" ? visibleDailyGroups.length === 0 ? <div className="empty-state compact"><span>⌗</span><h2>この日の履歴はありません</h2><p>別の日付を選ぶか、すべての日付を表示してください。</p><button className="button ghost-button" onClick={() => setSelectedDate("")}>すべての日付を見る</button></div> : <div className="daily-history">{visibleDailyGroups.map(([date, dayAttempts]) => { const correct = dayAttempts.filter((attempt) => attempt.correct).length; const rate = Math.round(correct / dayAttempts.length * 100); return <section className="day-group" key={date}><header><div><h3>{dateLabel(date)}</h3><p>{dayAttempts.length}問中 {correct}問正解</p></div><strong>{rate}<small>%</small></strong></header><div className="attempt-list">{dayAttempts.map((a) => <article key={a.id}><span className={a.correct ? "correct" : "wrong"}>{a.correct ? "✓" : "×"}</span><div>{questionLink(a.questionId)}<p>{new Intl.DateTimeFormat("ja-JP", { hour:"2-digit", minute:"2-digit" }).format(new Date(a.answeredAt))} ・ 回答「{a.answer || "未回答"}」</p></div></article>)}</div></section>; })}</div> : <div className="attempt-list">{attempts.map((a) => <article key={a.id}><span className={a.correct ? "correct" : "wrong"}>{a.correct ? "✓" : "×"}</span><div>{questionLink(a.questionId)}<p>{new Intl.DateTimeFormat("ja-JP", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(a.answeredAt))} ・ 回答「{a.answer || "未回答"}」</p></div></article>)}</div>}
  </section>;
}

async function downloadBackup(backup: ManaBloomBackup, prefix = "manabloom-backup") {
  const contents = JSON.stringify(backup, null, 2);
  const filename = `${prefix}-${backup.exportedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
  const isNativeApp = typeof window !== "undefined" && "Capacitor" in window;
  if (isNativeApp) {
    const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const saved = await Filesystem.writeFile({ path: filename, data: contents, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: "ManaBloom バックアップ", text: "学習データのバックアップです。", url: saved.uri, dialogTitle: "バックアップを保存・共有" });
    return;
  }
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Settings({ onRestored }: { onRestored: () => Promise<void> }) {
  const [candidate, setCandidate] = useState<ManaBloomBackup | null>(null);
  const [backupError, setBackupError] = useState("");
  const [busy, setBusy] = useState(false);
  const isNativeApp = typeof window !== "undefined" && "Capacitor" in window;
  const privacyHref = isNativeApp ? "./privacy.html" : "/privacy";
  const supportHref = isNativeApp ? "./support.html" : "/support";
  const contactHref = `mailto:zardibuki@icloud.com?subject=${encodeURIComponent("ManaBloomへのお問い合わせ")}&body=${encodeURIComponent("お問い合わせ内容：\n\n\n---\nアプリ：ManaBloom 0.1.0")}`;
  async function exportData() { setBusy(true); try { await downloadBackup(await createBackup()); } finally { setBusy(false); } }
  async function selectBackup(file?: File) {
    setCandidate(null); setBackupError("");
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setBackupError("ファイルが大きすぎます。10MB以下のバックアップを選んでください。"); return; }
    try { setCandidate(parseBackup(JSON.parse(await file.text()))); }
    catch (error) { setBackupError(error instanceof Error ? error.message : "バックアップを読み込めませんでした。"); }
  }
  async function applyBackup() {
    if (!candidate || !window.confirm("現在のデータを、選択したバックアップの内容に置き換えますか？")) return;
    setBusy(true);
    try {
      await downloadBackup(await createBackup(), "manabloom-before-restore");
      await restoreBackup(candidate);
      setCandidate(null);
      await onRestored();
    } catch { setBackupError("復元できませんでした。現在のデータは変更されていません。"); }
    finally { setBusy(false); }
  }
  return <section className="page"><div className="page-title"><div><p className="eyebrow">SETTINGS</p><h1>設定</h1><p>このアプリとデータについて。</p></div></div><div className="settings-grid"><article><span>▣</span><div><h2>データの保存先</h2><p>カテゴリ・問題・回答履歴は、この端末のブラウザ内に保存されています。サーバーへの送信は行いません。</p><small>ブラウザのデータを削除すると、学習データも消去されます。</small><a className="settings-link" href={privacyHref}>プライバシーポリシーを見る</a></div></article><article className="backup-card"><span>⇩</span><div><h2>バックアップと移行</h2><p>学習データをJSONファイルに保存し、別の端末でも復元できます。</p><div className="backup-actions"><button className="button ghost-button" disabled={busy} onClick={() => void exportData()}>バックアップを書き出す</button><label className={busy ? "button ghost-button disabled" : "button ghost-button"}>バックアップを選ぶ<input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => { void selectBackup(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div>{backupError && <p className="backup-error" role="alert">{backupError}</p>}{candidate && <div className="backup-preview"><strong>復元する内容</strong><p>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(candidate.exportedAt))}のバックアップ</p><ul><li>カテゴリ：{candidate.data.categories.length}件</li><li>問題：{candidate.data.questions.length}件</li><li>回答履歴：{candidate.data.attempts.length}件</li><li>学習履歴：{candidate.data.sessions.length}件</li></ul><button className="button primary-button" disabled={busy} onClick={() => void applyBackup()}>現在のデータを置き換えて復元</button><small>復元前の現在データも、自動でファイルに保存します。</small></div>}</div></article><article><span>✉</span><div><h2>お問い合わせ</h2><p>ご意見、不具合、追加してほしい機能の報告はこちらからお送りください。</p><div className="contact-action"><a className="button ghost-button" href={contactHref}>メールで問い合わせる</a><a className="button ghost-button" href={supportHref}>サポートを見る</a></div><small>メール送信前に、サポートページのよくある質問もご確認いただけます。</small></div></article></div></section>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) { return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span>{label}</button>; }
