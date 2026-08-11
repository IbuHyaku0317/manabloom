import Dexie, { type EntityTable } from "dexie";

export type AnswerType = "text" | "letters" | "boolean";

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

class StudyDatabase extends Dexie {
  categories!: EntityTable<Category, "id">;
  questions!: EntityTable<Question, "id">;
  attempts!: EntityTable<Attempt, "id">;
  sessions!: EntityTable<StudySession, "id">;

  constructor() {
    super("manabloom-study-db");
    this.version(1).stores({
      categories: "id, name, createdAt",
      questions: "id, categoryId, answerType, updatedAt",
      attempts: "id, questionId, correct, answeredAt, sessionId",
      sessions: "id, startedAt, finishedAt",
    });
  }
}

export const db = new StudyDatabase();

export async function initializeDatabase() {
  if ((await db.categories.count()) > 0) return;
  const now = new Date().toISOString();
  await db.categories.bulkAdd([
    { id: crypto.randomUUID(), name: "英語", color: "#e9a23b", createdAt: now },
    { id: crypto.randomUUID(), name: "数学", color: "#557c6b", createdAt: now },
    { id: crypto.randomUUID(), name: "その他", color: "#8b77a8", createdAt: now },
  ]);
}
