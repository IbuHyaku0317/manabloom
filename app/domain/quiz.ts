import type { AnswerType, Question } from "../db";

export type Tab = "home" | "library" | "history" | "settings";

export type Screen =
  | "main"
  | "question-form"
  | "study-setup"
  | "quiz"
  | "result";

export type Filter =
  | "all"
  | "last-wrong"
  | "ever-wrong"
  | "unanswered"
  | "weak";

export type QuizAnswer = {
  question: Question;
  answer: string;
  correct: boolean;
};

export const categoryColors = [
  "#557c6b",
  "#e9a23b",
  "#cf705c",
  "#6b7da8",
  "#8b77a8",
];

export const answerLabels: Record<AnswerType, string> = {
  text: "フリー入力",
  letters: "一文字ずつ4択",
  boolean: "○×問題",
  "multiple-choice": "択数回答",
};

export const shuffle = <T>(items: T[]) =>
  [...items].sort(() => Math.random() - 0.5);

export function questionTextSize(prompt: string) {
  const characterCount = [...prompt.replace(/\s/g, "")].length;
  const lineBreakWeight = Math.max(0, prompt.split("\n").length - 1) * 20;
  const length = characterCount + lineBreakWeight;

  if (length > 180) return "question-text-xlong";
  if (length > 100) return "question-text-long";
  if (length > 50) return "question-text-medium";
  return "question-text-short";
}

/**
 * 一覧の表示幅を全角20文字相当へ揃える。
 * 半角文字は0.5文字として数えるため、日本語と英数字が混ざっても見た目が崩れにくい。
 */
export function truncateQuestionPrompt(
  prompt: string,
  maxFullWidthCharacters = 20,
) {
  const characters = [...prompt];
  let width = 0;
  let end = 0;

  for (const character of characters) {
    const characterWidth = /^[\u0020-\u007e\uff61-\uff9f]$/.test(character)
      ? 0.5
      : 1;
    if (width + characterWidth > maxFullWidthCharacters) break;

    width += characterWidth;
    end += 1;
  }

  return end < characters.length
    ? `${characters.slice(0, end).join("")}...`
    : prompt;
}

export function makeLetterChoices(answer: string, index: number) {
  const right = answer[index];
  const hiragana =
    "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉゃゅょっ";
  const katakana =
    "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォャュョッー";
  const kanji =
    "一二三四五六七八九十百千万上下左右大小中年月日時分人男女子先生学校国語数学英理科社会山川田空天気雨雪花草木林森火水土金本文字名前東西南北入口出口車電力音食飲見聞読書話言行来帰高低長短新古多少白黒赤青春夏秋冬朝昼夜海島町村市道家室友父母兄弟姉妹魚鳥犬猫牛馬";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const fullwidthUppercase =
    "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ";
  const fullwidthLowercase =
    "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ";
  const digits = "0123456789";
  const fullwidthDigits = "０１２３４５６７８９";
  const symbols =
    "＋－×÷＝！？・、。．，：；〜ー+-*/=!?.,:;<>（）()「」『』【】[]";

  // 正解と同じ文字種から誤答を作ると、4択が不自然になりにくい。
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

  const candidates = [
    ...new Set([...pool].filter((letter) => letter !== right)),
  ];
  const fallback = [
    ...new Set(
      [...hiragana, ...katakana, ...uppercase, ...digits].filter(
        (letter) => letter !== right && !candidates.includes(letter),
      ),
    ),
  ];
  const wrong = shuffle(
    candidates.length >= 3 ? candidates : [...candidates, ...fallback],
  ).slice(0, 3);

  return shuffle([right, ...wrong]);
}
