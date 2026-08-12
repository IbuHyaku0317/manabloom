import React from "react";
import { createRoot } from "react-dom/client";
import QuizApp from "../app/QuizApp";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><QuizApp /></React.StrictMode>);
