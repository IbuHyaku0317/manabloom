import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("ManaBloomのアプリ画面を返す", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>ManaBloom/);
  assert.match(html, /自分でつくる学習帳/);
  assert.match(html, /この端末に保存/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /リリース検討中|現在はご利用いただけません/);
});

test("プライバシーポリシーを返す", async () => {
  const response = await render("/privacy");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /プライバシーポリシー/);
  assert.match(html, /ManaBloom運営/);
  assert.match(html, /zardibuki@icloud\.com/);
});

test("サポートページを返す", async () => {
  const response = await render("/support");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /サポート/);
  assert.match(html, /別の端末へデータを移すには/);
  assert.match(html, /zardibuki@icloud\.com/);
});
