"use client";

import { useState } from "react";
import {
  createBackup,
  parseBackup,
  restoreBackup,
  type ManaBloomBackup,
} from "../../db";
import { PageTitle } from "../molecules/PageTitle";

async function downloadBackup(
  backup: ManaBloomBackup,
  prefix = "manabloom-backup",
) {
  const contents = JSON.stringify(backup, null, 2);
  const filename = `${prefix}-${backup.exportedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
  const isNativeApp = typeof window !== "undefined" && "Capacitor" in window;
  if (isNativeApp) {
    const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const saved = await Filesystem.writeFile({
      path: filename,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "ManaBloom バックアップ",
      text: "学習データのバックアップです。",
      url: saved.uri,
      dialogTitle: "バックアップを保存・共有",
    });
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

export function Settings({ onRestored }: { onRestored: () => Promise<void> }) {
  const [candidate, setCandidate] = useState<ManaBloomBackup | null>(null);
  const [backupError, setBackupError] = useState("");
  const [busy, setBusy] = useState(false);
  const isNativeApp = typeof window !== "undefined" && "Capacitor" in window;
  const privacyHref = isNativeApp ? "./privacy.html" : "/privacy";
  const supportHref = isNativeApp ? "./support.html" : "/support";
  const contactHref = `mailto:zardibuki@icloud.com?subject=${encodeURIComponent("ManaBloomへのお問い合わせ")}&body=${encodeURIComponent("お問い合わせ内容：\n\n\n---\nアプリ：ManaBloom 0.1.0")}`;
  async function exportData() {
    setBusy(true);
    try {
      await downloadBackup(await createBackup());
    } finally {
      setBusy(false);
    }
  }
  async function selectBackup(file?: File) {
    setCandidate(null);
    setBackupError("");
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setBackupError(
        "ファイルが大きすぎます。10MB以下のバックアップを選んでください。",
      );
      return;
    }
    try {
      setCandidate(parseBackup(JSON.parse(await file.text())));
    } catch (error) {
      setBackupError(
        error instanceof Error
          ? error.message
          : "バックアップを読み込めませんでした。",
      );
    }
  }
  async function applyBackup() {
    if (
      !candidate ||
      !window.confirm(
        "現在のデータを、選択したバックアップの内容に置き換えますか？",
      )
    )
      return;
    setBusy(true);
    try {
      await downloadBackup(await createBackup(), "manabloom-before-restore");
      await restoreBackup(candidate);
      setCandidate(null);
      await onRestored();
    } catch {
      setBackupError(
        "復元できませんでした。現在のデータは変更されていません。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page">
      <PageTitle
        eyebrow="SETTINGS"
        title="設定"
        description="このアプリとデータについて。"
      />
      <div className="settings-grid">
        <article>
          <span>▣</span>
          <div>
            <h2>データの保存先</h2>
            <p>
              カテゴリ・問題・回答履歴は、この端末のブラウザ内に保存されています。サーバーへの送信は行いません。
            </p>
            <small>
              ブラウザのデータを削除すると、学習データも消去されます。
            </small>
            <a className="settings-link" href={privacyHref}>
              プライバシーポリシーを見る
            </a>
          </div>
        </article>
        <article className="backup-card">
          <span>⇩</span>
          <div>
            <h2>バックアップと移行</h2>
            <p>学習データをJSONファイルに保存し、別の端末でも復元できます。</p>
            <div className="backup-actions">
              <button
                className="button ghost-button"
                disabled={busy}
                onClick={() => void exportData()}
              >
                バックアップを書き出す
              </button>
              <label
                className={
                  busy ? "button ghost-button disabled" : "button ghost-button"
                }
              >
                バックアップを選ぶ
                <input
                  type="file"
                  accept="application/json,.json"
                  disabled={busy}
                  onChange={(event) => {
                    void selectBackup(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {backupError && (
              <p className="backup-error" role="alert">
                {backupError}
              </p>
            )}
            {candidate && (
              <div className="backup-preview">
                <strong>復元する内容</strong>
                <p>
                  {new Intl.DateTimeFormat("ja-JP", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(candidate.exportedAt))}
                  のバックアップ
                </p>
                <ul>
                  <li>カテゴリ：{candidate.data.categories.length}件</li>
                  <li>問題：{candidate.data.questions.length}件</li>
                  <li>回答履歴：{candidate.data.attempts.length}件</li>
                  <li>学習履歴：{candidate.data.sessions.length}件</li>
                </ul>
                <button
                  className="button primary-button"
                  disabled={busy}
                  onClick={() => void applyBackup()}
                >
                  現在のデータを置き換えて復元
                </button>
                <small>
                  復元前の現在データも、自動でファイルに保存します。
                </small>
              </div>
            )}
          </div>
        </article>
        <article>
          <span>✉</span>
          <div>
            <h2>お問い合わせ</h2>
            <p>
              ご意見、不具合、追加してほしい機能の報告はこちらからお送りください。
            </p>
            <div className="contact-action">
              <a className="button ghost-button" href={contactHref}>
                メールで問い合わせる
              </a>
              <a className="button ghost-button" href={supportHref}>
                サポートを見る
              </a>
            </div>
            <small>
              メール送信前に、サポートページのよくある質問もご確認いただけます。
            </small>
          </div>
        </article>
      </div>
    </section>
  );
}
