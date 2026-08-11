import type { Metadata } from "next";
import QuizApp from "./QuizApp";

export const metadata: Metadata = {
  title: "ManaBloom｜自分でつくる学習帳",
  description: "問題を自分で作って、苦手を繰り返し学べるオフライン学習アプリ",
};

export default function Home() {
  return <QuizApp />;
}
