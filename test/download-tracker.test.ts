import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { gunzipSync } from "node:zlib";
import { classifyRequest } from "../workers/download-tracker/src/classify.js";
import { THEME } from "../workers/download-tracker/src/home.js";
import { TRACKER, handleRequest } from "../workers/download-tracker/src/index.js";
import { invariantHolds } from "../workers/download-tracker/src/stats-shape.js";
import { RUNTIME_TEXT } from "../workers/download-tracker/src/runtime.js";
import { packArchive } from "../workers/download-tracker/scripts/pack-archive.mjs";
import { HONESTY_INVARIANT, LIMITATION } from "../src/engine.ts";

const ARCHIVE = new URL("../workers/download-tracker/public/zkattest-0.1.0.tar.gz", import.meta.url);
const ROOT = new URL("..", import.meta.url);

const STATS_KEYS = [
  "project", "total", "views", "downloads",
  "views_human", "views_bot", "downloads_human", "downloads_bot",
  "human", "bot", "classification",
  "by_repo", "by_branch", "by_fork", "breakdown",
  "github", "note",
];

function memoryKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, String(value));
    },
    async list() {
      return {
        keys: [...store.keys()].map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

function diskAssets() {
  return {
    async fetch(request: Request) {
      const url = new URL(request.url);
      const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (name.includes("..") || name !== "zkattest-0.1.0.tar.gz") {
        return new Response("missing", { status: 404 });
      }
      const buf = readFileSync(ARCHIVE);
      return new Response(buf, {
        status: 200,
        headers: { "content-length": String(buf.byteLength) },
      });
    },
  };
}

function githubFetch(log: string[] = []) {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    log.push(url);
    if (url.endsWith("/releases")) {
      return new Response(JSON.stringify([{ assets: [{ download_count: 4 }, { download_count: 0 }] }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      stargazers_count: 1,
      forks_count: 0,
      subscribers_count: 0,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

function makeEnv(fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const env: Record<string, unknown> = {
    DOWNLOADS: memoryKv(),
    ASSETS: diskAssets(),
    AZIEL_RUNTIME_ORIGIN: "https://aziel-runtime.example",
  };
  if (fetchImpl) env.AZIEL_RUNTIME = { fetch: fetchImpl };
  return env;
}

async function call(
  path: string,
  init: RequestInit & { cf?: unknown } = {},
  env: Record<string, unknown> = makeEnv(),
) {
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", "Mozilla/5.0");
  const { cf, ...rest } = init;
  const req = new Request("http://127.0.0.1" + path, rest);
  if (cf) Object.defineProperty(req, "cf", { value: cf });
  const previous = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = githubFetch(seen) as typeof fetch;
  try {
    const response = await handleRequest(req, env);
    return { response, seen };
  } finally {
    globalThis.fetch = previous;
  }
}

async function counts(env: Record<string, unknown>) {
  const { response } = await call("/count", {}, env);
  return response.json() as Promise<Record<string, unknown>>;
}

function contrast(hexA: string, hexB: string) {
  const lum = (hex: string) => {
    const n = hex.replace("#", "");
    const rgb = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
  };
  const a = lum(hexA);
  const b = lum(hexB);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function assertSchema(stats: Record<string, unknown>) {
  assert.deepEqual(Object.keys(stats).sort(), [...STATS_KEYS].sort());
  assert.equal(stats.project, "zkattest");
  assert.equal(stats.total, stats.downloads);
  assert.equal(invariantHolds(stats), true);
  const human = stats.human as { views: number; downloads: number };
  const bot = stats.bot as { views: number; downloads: number };
  assert.equal(stats.views, human.views + bot.views);
  assert.equal(stats.downloads, human.downloads + bot.downloads);
  assert.equal(stats.views_human, human.views);
  assert.equal(stats.views_bot, bot.views);
  const classification = stats.classification as {
    method: string;
    bot_score_threshold: number;
    note: string;
    legacy: string;
  };
  assert.equal(classification.bot_score_threshold, 30);
  assert.match(classification.note, /strategy \(b\)/);
  assert.match(classification.legacy, /views_bot = views - views_human/);
  const github = stats.github as Record<string, unknown>;
  assert.deepEqual(Object.keys(github).sort(), [
    "fetched_at",
    "forks",
    "release_download_count",
    "stars",
    "watchers",
  ]);
  assert.equal(typeof github.fetched_at, "number");
  assert.equal(stats.note, "Forks identified by GitHub owner/repo. Key layout: project|owner|repo|branch|fork");
}

describe("download tracker routes", () => {
  it("serves the archive with HTTP 200, counts branches and forks, and keeps the schema", async () => {
    assert.equal(TRACKER.project, "zkattest");
    assert.equal(TRACKER.version, "0.1.0");
    assert.equal(TRACKER.asset, "zkattest-0.1.0.tar.gz");
    assert.equal(TRACKER.kv_title, "ZKATTEST_DOWNLOADS");
    assert.ok(statSync(ARCHIVE).size > 100);

    const env = makeEnv();
    const res = await call("/download", {}, env);
    assert.equal(res.response.status, 200);
    assert.equal(res.response.headers.get("location"), null);
    assert.match(res.response.headers.get("content-type") || "", /application\/gzip/);
    assert.match(res.response.headers.get("content-disposition") || "", /zkattest-0\.1\.0\.tar\.gz/);
    assert.equal(res.response.headers.get("access-control-allow-origin"), "*");
    const bytes = new Uint8Array(await res.response.arrayBuffer());
    const file = new Uint8Array(readFileSync(ARCHIVE));
    assert.deepEqual(bytes, file);
    assert.equal(bytes[0], 0x1f);
    assert.equal(bytes[1], 0x8b);
    assert.ok(gunzipSync(bytes).byteLength > 100);

    const again = await call("/download?branch=dev", {}, env);
    assert.equal(again.response.status, 200);
    const fork = await call("/download?owner=Other&repo=zkattest&branch=main&fork=0", {}, env);
    assert.equal(fork.response.status, 200);
    const viaGo = await call("/go", {}, env);
    assert.equal(viaGo.response.status, 200);
    assert.deepEqual(new Uint8Array(await viaGo.response.arrayBuffer()), file);
    const viaPath = await call("/download/zkattest-0.1.0.tar.gz", {}, env);
    assert.equal(viaPath.response.status, 200);

    const count = await counts(env);
    assert.equal(count.project, "zkattest");
    assert.equal(count.downloads, 5);
    assert.equal(count.total, 5);
    assert.equal(count.views, 0);
    assert.equal(count.downloads, (count.downloads_human as number) + (count.downloads_bot as number));

    const statsRes = await call("/stats", {}, env);
    const stats = await statsRes.response.json() as Record<string, any>;
    assertSchema(stats);
    assert.equal(stats.classification.method, "ua_denylist + healthcheck_ua");
    assert.equal(stats.by_branch.main, 4);
    assert.equal(stats.by_branch.dev, 1);
    assert.equal(stats.by_fork["0"], 4);
    assert.equal(stats.by_fork["1"], 1);
    assert.equal(stats.by_repo["AzielEliab/zkattest"], 4);
    assert.equal(stats.by_repo["Other/zkattest"], 1);
    assert.equal(stats.github.stars, 1);
    assert.equal(stats.github.release_download_count, 4);
    assert.equal(stats.breakdown.length, 3);
    for (const row of stats.breakdown) {
      assert.deepEqual(Object.keys(row).sort(), ["branch", "count", "fork", "owner", "project", "repo"]);
    }

    const againStats = await call("/stats", {}, env);
    const cached = await againStats.response.json() as { views: number; downloads: number; github: { fetched_at: number } };
    assert.equal(cached.views, stats.views);
    assert.equal(cached.downloads, stats.downloads);
    assert.equal(cached.github.fetched_at, stats.github.fetched_at);
    assert.equal(againStats.seen.length, 0);
  });

  it("does not count HEAD, a missing asset, stats, count, install, or discovery", async () => {
    const env = makeEnv();
    const before = await counts(env);
    const missing = await call("/download?asset=zkattest-9.9.9.tar.gz", {}, env);
    assert.equal(missing.response.status, 404);
    const missingBody = await missing.response.json() as { error: string; hosted: string; asset: string };
    assert.equal(missingBody.error, "asset not hosted");
    assert.equal(missingBody.hosted, "zkattest-0.1.0.tar.gz");
    assert.equal(missingBody.asset, "zkattest-9.9.9.tar.gz");
    const head = await call("/download", { method: "HEAD" }, env);
    assert.equal(head.response.status, 200);
    assert.match(head.response.headers.get("content-type") || "", /gzip/);
    assert.equal(await head.response.text(), "");
    const postDownload = await call("/download", { method: "POST" }, env);
    assert.equal(postDownload.response.status, 404);
    const install = await call("/install.sh", {}, env);
    assert.equal(install.response.status, 200);
    const script = await install.response.text();
    assert.match(script, /curl -fsSL -A 'Mozilla\/5\.0'/);
    assert.match(script, /ASSET="zkattest-0\.1\.0\.tar\.gz"/);
    assert.match(script, /\/download\?asset=\$\{ASSET\}/);
    assert.match(script, /REAL-not-ZK/);
    assert.match(script, /SLOT/);
    for (const path of ["/cite.json", "/sitemap.xml", "/robots.txt", "/llms.txt", "/ai.txt", "/openapi.json"]) {
      const res = await call(path, {}, env);
      assert.equal(res.response.status, 200, path);
      assert.equal(res.response.headers.get("access-control-allow-origin"), "*");
    }
    const cite = await (await call("/cite.json", {}, env)).response.json() as { zk_system: boolean; honesty: { open: string; groth16: string } };
    assert.equal(cite.zk_system, false);
    assert.equal(cite.honesty.open, "REAL-not-ZK");
    assert.equal(cite.honesty.groth16, "SLOT");
    const after = await counts(env);
    assert.equal(after.downloads, before.downloads);
    assert.equal(after.views, before.views);
  });

  it("keeps the human/bot remainder and does not trust a stored bot key", async () => {
    const env = makeEnv();
    await env.DOWNLOADS.put("zkattest|__views__", "10");
    await env.DOWNLOADS.put("zkattest|__views_human__", "3");
    await env.DOWNLOADS.put("zkattest|__views_bot__", "999");
    await env.DOWNLOADS.put("zkattest|__total__", "4");
    await env.DOWNLOADS.put("zkattest|__downloads_human__", "1");
    await env.DOWNLOADS.put("zkattest|__downloads_bot__", "999");
    const stats = await (await call("/stats", {}, env)).response.json() as Record<string, any>;
    assertSchema(stats);
    assert.equal(stats.views, 10);
    assert.equal(stats.views_human, 3);
    assert.equal(stats.views_bot, 7);
    assert.equal(stats.downloads, 4);
    assert.equal(stats.downloads_human, 1);
    assert.equal(stats.downloads_bot, 3);
    assert.equal(stats.total, 4);

    const envCap = makeEnv();
    await envCap.DOWNLOADS.put("zkattest|__views__", "10");
    await envCap.DOWNLOADS.put("zkattest|__views_human__", "50");
    const capped = await (await call("/stats", {}, envCap)).response.json() as Record<string, number>;
    assert.equal(capped.views_human, 10);
    assert.equal(capped.views_bot, 0);
  });

  it("classifies bots, health checks, and bot-management scores without inventing a zero score", async () => {
    assert.equal(classifyRequest({ headers: new Headers({ "user-agent": "" }) }).bucket, "bot");
    assert.equal(classifyRequest({ headers: new Headers({ "user-agent": "curl/8.0" }) }).reason, "ua_denylist");
    assert.equal(classifyRequest({ headers: new Headers({ "user-agent": "UptimeRobot/1.0" }) }).reason, "healthcheck_ua");

    const env = makeEnv();
    await call("/download", { headers: { "user-agent": "" } }, env);
    await call("/", { headers: { "user-agent": "curl/8.0" } }, env);
    await call("/download", { headers: { "user-agent": "UptimeRobot/1.0" } }, env);
    await call("/download", {
      headers: { "user-agent": "Mozilla/5.0" },
      cf: { botManagement: { score: 30, verifiedBot: false } },
    }, env);
    await call("/", {
      headers: { "user-agent": "Mozilla/5.0" },
      cf: { botManagement: { score: 31, verifiedBot: false } },
    }, env);
    await call("/download", {
      headers: { "user-agent": "Mozilla/5.0" },
      cf: { botManagement: { score: 0 } },
    }, env);
    const stats = await (await call("/stats", {
      cf: { botManagement: { score: 90, verifiedBot: false } },
    }, env)).response.json() as Record<string, any>;
    assertSchema(stats);
    assert.equal(stats.classification.method, "cf.botManagement.score + ua_denylist + healthcheck_ua");
    assert.equal(stats.classification.bot_score_threshold, 30);
    assert.equal(stats.downloads, 4);
    assert.equal(stats.downloads_human, 1);
    assert.equal(stats.downloads_bot, 3);
    assert.equal(stats.views, 2);
    assert.equal(stats.views_human, 1);
    assert.equal(stats.views_bot, 1);
    assert.equal(stats.views, stats.views_human + stats.views_bot);
    assert.equal(stats.downloads, stats.downloads_human + stats.downloads_bot);
  });

  it("records POST /event and does not increment on /v1 or /mcp", async () => {
    const seen: { url: string; method: string; body: string }[] = [];
    const env = makeEnv(async (input, init) => {
      const url = String(input);
      const method = init?.method || "GET";
      const body = init?.body ? new TextDecoder().decode(init.body as ArrayBuffer) : "";
      seen.push({ url, method, body });
      return new Response(JSON.stringify({ ok: true, proxied: true, enabled: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const home = await call("/", {}, env);
    assert.equal(home.response.status, 200);
    const html = await home.response.text();
    assert.match(html, /<h1>zkattest<\/h1>/);
    assert.match(html, /ZK-ATTEST-0\.1/);
    assert.match(html, /REAL-not-ZK/);
    assert.match(html, /SLOT/);
    assert.match(html, /id="download" href="\/download"/);
    assert.match(html, /prefers-color-scheme:\s*light/);
    assert.match(html, /:focus-visible/);
    assert.doesNotMatch(html, /ZK-SNARK proof (is|was) (included|attached|generated)/i);
    for (const theme of [THEME.dark, THEME.light]) {
      assert.ok(contrast(theme.ink, theme.bg) >= 4.5);
      assert.ok(contrast(theme.muted, theme.bg) >= 4.5);
      assert.ok(contrast(theme.btnInk, theme.btnBg) >= 4.5);
      assert.ok(contrast(theme.focus, theme.bg) >= 3);
    }

    const viewsAfterHome = await counts(env);
    assert.equal(viewsAfterHome.views, 1);
    assert.equal(viewsAfterHome.downloads, 0);

    const health = await call("/v1/health", {}, env);
    assert.equal(health.response.status, 200);
    const healthBody = await health.response.json() as Record<string, unknown>;
    assert.equal(healthBody.version, "0.1.0");
    assert.equal(healthBody.kv_increment, false);
    assert.equal(healthBody.mesh_enabled_by_get, false);
    assert.equal(healthBody.zk_system, false);
    assert.equal(healthBody.proof_systems, "SLOT");
    const limit = await call("/v1/limitation", {}, env);
    const limitBody = await limit.response.json() as { limitation: string; invariant: string };
    assert.equal(limitBody.limitation, LIMITATION);
    assert.equal(limitBody.invariant, HONESTY_INVARIANT);
    assert.equal(RUNTIME_TEXT.LIMITATION, LIMITATION);
    const slot = await call("/v1/groth16", {}, env);
    assert.equal(slot.response.status, 501);
    const slotBody = await slot.response.json() as { honesty_label: string; proof: unknown; zk_system: boolean };
    assert.equal(slotBody.honesty_label, "SLOT");
    assert.equal(slotBody.proof, null);
    assert.equal(slotBody.zk_system, false);
    const refused = await call("/v1/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ witness: "hidden" }),
    }, env);
    assert.equal(refused.response.status, 400);
    const refusedBody = await refused.response.json() as { code: string; proof: unknown };
    assert.equal(refusedBody.code, "ZKATTEST-DOOR");
    assert.equal(refusedBody.proof, null);

    const mesh = await call("/v1/mesh", {}, env);
    assert.equal(mesh.response.status, 200);
    assert.equal(mesh.response.headers.get("x-aziel-door"), "proxy");
    assert.equal(seen[0]?.method, "GET");
    assert.equal(seen[0]?.body, "");
    assert.match(seen[0]?.url || "", /\/v1\/mesh$/);
    const callDoor = await call("/v1/fraggate/call", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "zkattest", op: "health" }),
    }, env);
    assert.equal(callDoor.response.status, 200);
    assert.equal(seen[1]?.method, "POST");
    assert.match(seen[1]?.body || "", /"op":"health"/);

    const mcp = await call("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }, env);
    const rpc = await mcp.response.json() as { result: { tools: { name: string }[] } };
    assert.deepEqual(rpc.result.tools.map((tool) => tool.name), [
      "zkattest_health",
      "zkattest_skill",
      "zkattest_doctor",
      "zkattest_limitation",
      "zkattest_describe",
    ]);
    const mcpGet = await call("/mcp/", {}, env);
    assert.equal(mcpGet.response.status, 200);
    const v1 = await call("/v1", {}, env);
    assert.equal(v1.response.status, 200);
    const preflight = await call("/download", { method: "OPTIONS" }, env);
    assert.equal(preflight.response.status, 204);
    assert.equal(preflight.response.headers.get("access-control-allow-origin"), "*");
    assert.match(preflight.response.headers.get("access-control-allow-methods") || "", /POST/);

    const still = await counts(env);
    assert.equal(still.downloads, 0);
    assert.equal(still.views, 1);

    const bad = await call("/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }, env);
    assert.equal(bad.response.status, 400);
    const arrayBody = await call("/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "[]",
    }, env);
    assert.equal(arrayBody.response.status, 400);
    const event = await call("/event", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" },
      body: JSON.stringify({ owner: "ForkUser", repo: "zkattest", branch: "feature", fork: true }),
    }, env);
    assert.equal(event.response.status, 200);
    const eventBody = await event.response.json() as Record<string, unknown>;
    assert.equal(eventBody.ok, true);
    assert.equal(eventBody.key, "zkattest|ForkUser|zkattest|feature|1");
    assert.equal(eventBody.count, 1);
    assert.equal(eventBody.owner, "ForkUser");
    assert.equal(eventBody.repo, "zkattest");
    assert.equal(eventBody.branch, "feature");
    assert.equal(eventBody.fork, "1");
    const named = await call("/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fork: "Someone/zkattest", branch: "patch" }),
    }, env);
    assert.equal(named.response.status, 200);
    const namedBody = await named.response.json() as { owner: string; repo: string; fork: string; branch: string };
    assert.equal(namedBody.owner, "Someone");
    assert.equal(namedBody.repo, "zkattest");
    assert.equal(namedBody.fork, "1");
    assert.equal(namedBody.branch, "patch");

    const stats = await (await call("/stats", {}, env)).response.json() as Record<string, any>;
    assertSchema(stats);
    assert.equal(stats.downloads, 2);
    assert.equal(stats.total, 2);
    assert.equal(stats.views, 1);
    assert.equal(stats.by_branch.feature, 1);
    assert.equal(stats.by_branch.patch, 1);
    assert.equal(stats.by_fork["1"], 2);
    assert.equal(stats.by_fork["0"], 0);
  });
});

describe("archive", () => {
  it("packs a reproducible tree whose package version is 0.1.0", () => {
    const dir = mkdtempSync(join(tmpdir(), "zkattest-pack-"));
    const fresh = packArchive(join(dir, "zkattest-0.1.0.tar.gz"));
    const committed = readFileSync(ARCHIVE);
    const packed = readFileSync(fresh);
    assert.equal(createHash("sha256").update(packed).digest("hex"), createHash("sha256").update(committed).digest("hex"));
    const listing = execFileSync("tar", ["-tzf", ARCHIVE.pathname], { encoding: "utf8" });
    assert.match(listing, /zkattest-0\.1\.0\/package\.json/);
    assert.match(listing, /zkattest-0\.1\.0\/src\/cli\.ts/);
    assert.match(listing, /zkattest-0\.1\.0\/LICENSE/);
    assert.match(listing, /zkattest-0\.1\.0\/README\.md/);
    assert.doesNotMatch(listing, /node_modules/);
    assert.doesNotMatch(listing, /\.tar\.gz/);
    const packageJson = execFileSync("tar", ["-xOzf", ARCHIVE.pathname, "zkattest-0.1.0/package.json"], { encoding: "utf8" });
    assert.equal(JSON.parse(packageJson).version, "0.1.0");
    assert.equal(JSON.parse(packageJson).license, "Apache-2.0");
    const second = packArchive(join(dir, "again.tar.gz"));
    assert.equal(
      createHash("sha256").update(readFileSync(second)).digest("hex"),
      createHash("sha256").update(packed).digest("hex"),
    );
    assert.equal(ROOT.protocol, "file:");
  });
});
