"use client";

import { useMemo } from "react";
import type { Question } from "../../db";
import {
  makeLetterChoices,
  questionTextSize,
  type QuizAnswer,
} from "../../domain/quiz";

export function Quiz({
  question,
  index,
  total,
  answer,
  letterAnswer,
  remaining,
  timeLimit,
  category,
  feedback,
  feedbackSaved,
  onAnswer,
  onLetter,
  onSubmit,
  onContinue,
  onQuit,
}: {
  question: Question;
  index: number;
  total: number;
  answer: string;
  letterAnswer: string;
  remaining: number;
  timeLimit: number;
  category: string;
  feedback: QuizAnswer | null;
  feedbackSaved: boolean;
  onAnswer: (s: string) => void;
  onLetter: (s: string) => void;
  onSubmit: (forcedAnswer?: string) => void;
  onContinue: () => void;
  onQuit: () => void;
}) {
  const choices = useMemo(
    () => makeLetterChoices(question.answer, letterAnswer.length),
    [letterAnswer.length, question.answer],
  );
  const complete = answer.trim().length > 0;
  return (
    <section className="quiz-page">
      <div className="quiz-top">
        <button onClick={onQuit}>× 終了</button>
        <span>{category}</span>
        <strong>
          {index + 1}
          <small> / {total}</small>
        </strong>
      </div>
      <div className="progress">
        <i style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <div className="quiz-content">
        <div className="quiz-meta">
          <span>QUESTION {String(index + 1).padStart(2, "0")}</span>
          {timeLimit > 0 && !feedback && (
            <b className={remaining <= 5 ? "urgent" : ""}>◷ {remaining}秒</b>
          )}
        </div>
        <h1 className={questionTextSize(question.prompt)}>{question.prompt}</h1>
        {feedback ? (
          <div
            className={
              feedback.correct
                ? "instant-feedback correct-feedback"
                : "instant-feedback wrong-feedback"
            }
            role="status"
            aria-live="assertive"
          >
            <span className="feedback-mark">
              {feedback.correct ? "✓" : "×"}
            </span>
            <h2>{feedback.correct ? "正解です！" : "不正解です"}</h2>
            {!feedback.correct && (
              <p>
                あなたの回答：<b>{feedback.answer || "未回答"}</b>
              </p>
            )}
            <div className="correct-answer">
              <small>正解</small>
              <strong>{question.displayAnswer || question.answer}</strong>
              {question.answerType === "letters" &&
                question.displayAnswer !== question.answer && (
                  <span>入力する答え：{question.answer}</span>
                )}
            </div>
            <button
              className="button primary-button"
              disabled={!feedbackSaved}
              onClick={onContinue}
            >
              {index + 1 >= total ? "結果を見る" : "次の問題へ"} →
            </button>
          </div>
        ) : (
          <>
            {question.answerType === "text" && (
              <div className="answer-area">
                <label>
                  答えを入力
                  <input
                    value={answer}
                    onChange={(e) => onAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && answer.trim()) onSubmit();
                    }}
                    placeholder="ここに答えを入力"
                  />
                </label>
              </div>
            )}
            {question.answerType === "boolean" && (
              <div className="boolean-answer">
                <button
                  className={answer === "○" ? "active" : ""}
                  onClick={() => onAnswer("○")}
                >
                  ○<span>正しい</span>
                </button>
                <button
                  className={answer === "×" ? "active" : ""}
                  onClick={() => onAnswer("×")}
                >
                  ×<span>間違い</span>
                </button>
              </div>
            )}
            {question.answerType === "multiple-choice" && (
              <div className="custom-choice-list">
                {question.choices?.map((choice, choiceIndex) => (
                  <button
                    key={choiceIndex}
                    className={answer === choice ? "active" : ""}
                    onClick={() => onAnswer(choice)}
                  >
                    <span>{choiceIndex + 1}</span>
                    <strong>{choice}</strong>
                    <i>{answer === choice ? "✓" : ""}</i>
                  </button>
                ))}
              </div>
            )}
            {question.answerType === "letters" && (
              <div className="letters-area">
                <div
                  className={
                    letterAnswer
                      ? "selected-letters filled"
                      : "selected-letters"
                  }
                  aria-live="polite"
                >
                  {letterAnswer || <span>文字を選んでください</span>}
                </div>
                {letterAnswer.length < question.answer.length ? (
                  <div className="letter-choices">
                    {choices.map((choice) => (
                      <button
                        key={choice}
                        onClick={() => {
                          const nextAnswer = letterAnswer + choice;
                          onLetter(nextAnswer);
                          if (
                            choice !== question.answer[letterAnswer.length] ||
                            nextAnswer.length === question.answer.length
                          )
                            onSubmit(nextAnswer);
                        }}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            {question.answerType !== "letters" && (
              <button
                className="button primary-button answer-submit"
                disabled={!complete}
                onClick={() => onSubmit()}
              >
                回答する
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
