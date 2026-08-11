import Dexie, { type EntityTable } from "dexie";

export type AnswerType = "text" | "letters" | "boolean" | "multiple-choice";

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Question {
  id: string;
  categoryId: string;
  prompt: string;
  answerType: AnswerType;
  answer: string;
  displayAnswer?: string;
  choices?: string[];
  correctChoiceIndex?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Attempt {
  id: string;
  questionId: string;
  answer: string;
  correct: boolean;
  answeredAt: string;
  elapsedSeconds: number;
  sessionId: string;
}

export interface StudySession {
  id: string;
  startedAt: string;
  finishedAt: string;
  total: number;
  correct: number;
}

export interface AppSetting {
  key: string;
  numericValues: number[];
}

export interface ManaBloomBackup {
  app: "ManaBloom";
  version: 1;
  exportedAt: string;
  data: {
    categories: Category[];
    questions: Question[];
    attempts: Attempt[];
    sessions: StudySession[];
    settings: AppSetting[];
  };
}

class StudyDatabase extends Dexie {
  categories!: EntityTable<Category, "id">;
  questions!: EntityTable<Question, "id">;
  attempts!: EntityTable<Attempt, "id">;
  sessions!: EntityTable<StudySession, "id">;
  settings!: EntityTable<AppSetting, "key">;

  constructor() {
    super("manabloom-study-db");
    this.version(1).stores({
      categories: "id, name, createdAt",
      questions: "id, categoryId, answerType, updatedAt",
      attempts: "id, questionId, correct, answeredAt, sessionId",
      sessions: "id, startedAt, finishedAt",
    });
    this.version(2).stores({
      categories: "id, name, createdAt",
      questions: "id, categoryId, answerType, updatedAt",
      attempts: "id, questionId, correct, answeredAt, sessionId",
      sessions: "id, startedAt, finishedAt",
    }).upgrade((transaction) => transaction.table<Question>("questions").toCollection().modify((question) => {
      if (!question.displayAnswer) question.displayAnswer = question.answer;
    }));
    this.version(3).stores({
      categories: "id, name, createdAt",
      questions: "id, categoryId, answerType, updatedAt",
      attempts: "id, questionId, correct, answeredAt, sessionId",
      sessions: "id, startedAt, finishedAt",
    }).upgrade(async (transaction) => {
      const categoryTable = transaction.table<Category>("categories");
      const questionTable = transaction.table<Question>("questions");
      const initialCategories = await categoryTable.where("name").anyOf("英語", "数学", "その他").toArray();
      for (const category of initialCategories) {
        const used = await questionTable.where("categoryId").equals(category.id).count();
        if (used === 0) await categoryTable.delete(category.id);
      }
    });
    this.version(4).stores({
      categories: "id, name, createdAt",
      questions: "id, categoryId, answerType, updatedAt",
      attempts: "id, questionId, correct, answeredAt, sessionId",
      sessions: "id, startedAt, finishedAt",
    });
    this.version(5).stores({
      categories: "id, name, createdAt",
      questions: "id, categoryId, answerType, updatedAt",
      attempts: "id, questionId, correct, answeredAt, sessionId",
      sessions: "id, startedAt, finishedAt",
      settings: "key",
    });
  }
}

export const db = new StudyDatabase();

export async function initializeDatabase() {
  await db.open();
  if (!await db.settings.get("timeLimits")) {
    await db.settings.put({ key: "timeLimits", numericValues: [10, 30, 60] });
  }
}

export async function createBackup(): Promise<ManaBloomBackup> {
  const [categories, questions, attempts, sessions, settings] = await Promise.all([
    db.categories.toArray(), db.questions.toArray(), db.attempts.toArray(),
    db.sessions.toArray(), db.settings.toArray(),
  ]);
  return { app: "ManaBloom", version: 1, exportedAt: new Date().toISOString(), data: { categories, questions, attempts, sessions, settings } };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const hasStrings = (value: Record<string, unknown>, keys: string[]) => keys.every((key) => typeof value[key] === "string");

export function parseBackup(value: unknown): ManaBloomBackup {
  if (!isRecord(value) || value.app !== "ManaBloom" || value.version !== 1 || typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt)) || !isRecord(value.data)) throw new Error("ManaBloomのバックアップファイルではありません。");
  const { categories, questions, attempts, sessions, settings } = value.data;
  if (![categories, questions, attempts, sessions, settings].every(Array.isArray)) throw new Error("バックアップ内のデータ形式が正しくありません。");
  if (!(categories as unknown[]).every((item) => isRecord(item) && hasStrings(item, ["id", "name", "color", "createdAt"]))) throw new Error("カテゴリのデータが正しくありません。");
  if (!(questions as unknown[]).every((item) => isRecord(item) && hasStrings(item, ["id", "categoryId", "prompt", "answerType", "answer", "createdAt", "updatedAt"]) && ["text", "letters", "boolean", "multiple-choice"].includes(item.answerType as string))) throw new Error("問題のデータが正しくありません。");
  if (!(attempts as unknown[]).every((item) => isRecord(item) && hasStrings(item, ["id", "questionId", "answer", "answeredAt", "sessionId"]) && typeof item.correct === "boolean" && typeof item.elapsedSeconds === "number")) throw new Error("回答履歴のデータが正しくありません。");
  if (!(sessions as unknown[]).every((item) => isRecord(item) && hasStrings(item, ["id", "startedAt", "finishedAt"]) && typeof item.total === "number" && typeof item.correct === "number")) throw new Error("学習履歴のデータが正しくありません。");
  if (!(settings as unknown[]).every((item) => isRecord(item) && typeof item.key === "string" && Array.isArray(item.numericValues) && item.numericValues.every((entry) => typeof entry === "number" && Number.isFinite(entry)))) throw new Error("設定データが正しくありません。");
  for (const collection of [categories, questions, attempts, sessions, settings] as unknown[][]) {
    const ids = collection.map((item) => (item as Record<string, unknown>).id ?? (item as Record<string, unknown>).key);
    if (new Set(ids).size !== ids.length) throw new Error("バックアップ内に重複したデータがあります。");
  }
  return value as unknown as ManaBloomBackup;
}

export async function restoreBackup(backup: ManaBloomBackup) {
  await db.transaction("rw", [db.categories, db.questions, db.attempts, db.sessions, db.settings], async () => {
    await Promise.all([db.categories.clear(), db.questions.clear(), db.attempts.clear(), db.sessions.clear(), db.settings.clear()]);
    await db.categories.bulkAdd(backup.data.categories);
    await db.questions.bulkAdd(backup.data.questions);
    await db.attempts.bulkAdd(backup.data.attempts);
    await db.sessions.bulkAdd(backup.data.sessions);
    await db.settings.bulkAdd(backup.data.settings);
  });
  await initializeDatabase();
}
