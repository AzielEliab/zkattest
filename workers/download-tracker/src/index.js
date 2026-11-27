import { handleSeoRoutes, renderHome } from "./home.js";
import { handleRuntimeApi } from "./runtime.js";
import { classifyRequest, readBotManagement } from "./classify.js";
import {
  isolatedKeys,
  isReservedCounterKey,
  shapeCountBody,
  shapeHumanBotFields,
} from "./stats-shape.js";

/**
 * zkattest download tracker (Cloudflare Worker).
 *
 * GET / and landing views increment view counters.
 * GET /download and GET /go serve zkattest-0.1.0.tar.gz with HTTP 200
 * (not a 302 to GitHub) and increment download counters.
 * POST /event records owner/repo/branch/fork.
 * GET /stats and GET /count do not increment.
 * /v1, /mcp, and /v1/mesh/* do not increment. GET never enables mesh.
 *
 * commit / verify are REAL SHA-256 in the CLI archive.
 * open is REAL-not-ZK. Groth16 / SNARK / STARK are SLOT.
 *
 * Author: Aziel Eliab only. Version is package.json 0.1.0.
 */

const PROJECT = "zkattest";
const KEYS = isolatedKeys(PROJECT);
const DEFAULT_ASSET = "zkattest-0.1.0.tar.gz";
const DEFAULT_OWNER = "AzielEliab";
const DEFAULT_REPO = "zkattest";
const DEFAULT_BRANCH = "main";
const HOST = "https://zkattest-download-tracker.vibelock.workers.dev";
const GITHUB_REPO_API = "https://api.github.com/repos/AzielEliab/zkattest";
const STATS_NOTE = "Forks identified by GitHub owner/repo. Key layout: project|owner|repo|branch|fork";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, mcp-session-id, User-Agent, Authorization",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() },
  });
}

function logEvent(event, fields) {
  console.log(JSON.stringify({ event, project: PROJECT, ...fields }));
}

function safeIdent(value, fallback) {
  const text = String(value ?? "");
  if (/^[A-Za-z0-9._-]{1,80}$/.test(text)) return text;
  return fallback;
}

function splitOwnerRepo(value, fallbackOwner, fallbackRepo) {
  if (typeof value === "string" && value.includes("/")) {
    const [owner, repo] = value.split("/").filter(Boolean);
    if (owner && repo) return { owner: safeIdent(owner, fallbackOwner), repo: safeIdent(repo, fallbackRepo) };
  }
  return { owner: fallbackOwner, repo: fallbackRepo };
}

export function parseDims(src) {
  const get = (key) => {
    if (src == null) return null;
    if (typeof src.get === "function") {
      const value = src.get(key);
      return value == null || value === "" ? null : value;
    }
    const value = src[key];
    return value == null || value === "" ? null : value;
  };

  let owner = safeIdent(get("owner"), DEFAULT_OWNER);
  let repo = get("repo") || DEFAULT_REPO;
  if (typeof repo === "string" && repo.includes("/")) {
    const split = splitOwnerRepo(repo, owner, DEFAULT_REPO);
    owner = split.owner;
    repo = split.repo;
  } else {
    repo = safeIdent(repo, DEFAULT_REPO);
  }

  const branch = safeIdent(get("branch"), DEFAULT_BRANCH);
  const tag = safeIdent(get("tag"), "latest");
  const assetRaw = get("asset");
  const asset = typeof assetRaw === "string" ? assetRaw : "";

  const forkRaw = get("fork");
  let fork = "0";
  if (forkRaw === 1 || forkRaw === true || forkRaw === "1" || forkRaw === "true") {
    fork = "1";
  } else if (typeof forkRaw === "string" && forkRaw.includes("/")) {
    const split = splitOwnerRepo(forkRaw, owner, repo);
    owner = split.owner;
    repo = split.repo;
    fork = "1";
  } else if (forkRaw != null && forkRaw !== 0 && forkRaw !== false && forkRaw !== "0" && forkRaw !== "false") {
    fork = "1";
  }

  if (`${owner}/${repo}`.toLowerCase() !== `${DEFAULT_OWNER}/${DEFAULT_REPO}`.toLowerCase()) {
    fork = "1";
  }

  return { project: PROJECT, owner, repo, branch, fork, tag, asset };
}

function kvKey(dims) {
  return `${dims.project}|${dims.owner}|${dims.repo}|${dims.branch}|${dims.fork}`;
}

function knownAsset(name) {
  if (name === DEFAULT_ASSET) return DEFAULT_ASSET;
  return null;
}

async function bump(env, key) {
  const next = parseInt((await env.DOWNLOADS.get(key)) || "0", 10) + 1;
  await env.DOWNLOADS.put(key, String(next));
  return next;
}

async function incrementSplit(env, humanKey, botKey, request) {
  const cls = classifyRequest(request);
  const splitKey = cls.bucket === "human" ? humanKey : botKey;
  await bump(env, splitKey);
  return cls;
}

async function increment(env, dims, request) {
  const key = kvKey(dims);
  const count = await bump(env, key);
  await bump(env, KEYS.total);
  if (request) await incrementSplit(env, KEYS.downloads_human, KEYS.downloads_bot, request);
  return count;
}

async function incrementViews(env, request) {
  const count = await bump(env, KEYS.views);
  if (request) await incrementSplit(env, KEYS.views_human, KEYS.views_bot, request);
  return count;
}

async function listAllKeys(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.DOWNLOADS.list(cursor ? { cursor } : {});
    keys.push(...(page.keys || []));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

async function githubStats(env) {
  const cached = await env.DOWNLOADS.get(KEYS.github);
  if (cached) {
    try {
      const obj = JSON.parse(cached);
      if (obj && obj.fetched_at && Date.now() - obj.fetched_at < 5 * 60 * 1000) return obj;
    } catch {
      /* ignore a broken cache and refetch */
    }
  }
  const headers = {
    "User-Agent": "Mozilla/5.0 zkattest-download-tracker",
    Accept: "application/vnd.github+json",
  };
  let stars = 0;
  let forks = 0;
  let watchers = 0;
  let release_download_count = 0;
  try {
    const repoRes = await fetch(GITHUB_REPO_API, { headers, signal: AbortSignal.timeout(4000) });
    if (repoRes.ok) {
      const repo = await repoRes.json();
      stars = Number(repo.stargazers_count) || 0;
      forks = Number(repo.forks_count) || 0;
      watchers = Number(repo.subscribers_count != null ? repo.subscribers_count : repo.watchers_count) || 0;
    }
    const relRes = await fetch(`${GITHUB_REPO_API}/releases`, { headers, signal: AbortSignal.timeout(4000) });
    if (relRes.ok) {
      const rels = await relRes.json();
      const list = Array.isArray(rels) ? rels : [];
      for (const rel of list) {
        const assets = Array.isArray(rel.assets) ? rel.assets : [];
        release_download_count += assets.reduce((sum, asset) => sum + (Number(asset.download_count) || 0), 0);
      }
    }
  } catch {
    /* public API; zeros stay honest */
  }
  const out = { stars, forks, watchers, release_download_count, fetched_at: Date.now() };
  try {
    await env.DOWNLOADS.put(KEYS.github, JSON.stringify(out));
  } catch {
    /* a stats read still returns the fresh object */
  }
  return out;
}

async function collectStats(env, request) {
  const keys = await listAllKeys(env);
  let summed = 0;
  const by_repo = {};
  const by_branch = {};
  const by_fork = { "0": 0, "1": 0 };
  const breakdown = [];

  for (const entry of keys) {
    const name = entry.name;
    if (isReservedCounterKey(name, PROJECT)) continue;
    const count = parseInt((await env.DOWNLOADS.get(name)) || "0", 10);
    if (!Number.isFinite(count) || count <= 0) continue;
    const parts = name.split("|");
    if (parts.length < 5) continue;
    const [project, owner, repo, branch, fork] = parts;
    summed += count;
    const repoId = `${owner}/${repo}`;
    by_repo[repoId] = (by_repo[repoId] || 0) + count;
    by_branch[branch] = (by_branch[branch] || 0) + count;
    const forkFlag = fork === "1" ? "1" : "0";
    by_fork[forkFlag] = (by_fork[forkFlag] || 0) + count;
    breakdown.push({ project, owner, repo, branch, fork: forkFlag, count });
  }

  const totalDirect = parseInt((await env.DOWNLOADS.get(KEYS.total)) || "0", 10) || 0;
  const views = parseInt((await env.DOWNLOADS.get(KEYS.views)) || "0", 10) || 0;
  const downloads = totalDirect > 0 ? totalDirect : summed;
  const github = await githubStats(env);
  const viewsHuman = parseInt((await env.DOWNLOADS.get(KEYS.views_human)) || "0", 10) || 0;
  const downloadsHuman = parseInt((await env.DOWNLOADS.get(KEYS.downloads_human)) || "0", 10) || 0;
  const botManagementAvailable = request ? readBotManagement(request).available : false;

  return {
    project: PROJECT,
    total: downloads,
    views,
    downloads,
    ...shapeHumanBotFields({
      views,
      downloads,
      views_human: viewsHuman,
      downloads_human: downloadsHuman,
      botManagementAvailable,
    }),
    by_repo,
    by_branch,
    by_fork,
    breakdown,
    github: {
      stars: github.stars || 0,
      forks: github.forks || 0,
      watchers: github.watchers || 0,
      release_download_count: github.release_download_count || 0,
      fetched_at: github.fetched_at,
    },
    note: STATS_NOTE,
  };
}

function installScript(requestUrl) {
  let origin = HOST;
  try {
    origin = new URL(requestUrl).origin;
  } catch {
    origin = HOST;
  }
  return `#!/usr/bin/env bash
# zkattest one-line install. The counted download is this Worker's archive.
# commit and verify are REAL SHA-256. open is REAL-not-ZK.
# Groth16, SNARK, and STARK are SLOT. No ZK-SNARK proof is included.
set -euo pipefail
HOST="${origin}"
ASSET="${DEFAULT_ASSET}"
WORKDIR="\${ZKATTEST_HOME:-\$HOME/zkattest}"
mkdir -p "\$WORKDIR"
cd "\$WORKDIR"
echo "Downloading \${ASSET} from \${HOST}/download"
curl -fsSL -A 'Mozilla/5.0' "\${HOST}/download?asset=\${ASSET}" -o "\${ASSET}"
tar -xzf "\${ASSET}"
if [ -d "zkattest-0.1.0" ]; then
  cd "zkattest-0.1.0"
fi
npm install
echo
echo "Installed zkattest 0.1.0 from the counted archive."
echo "REAL:  npx tsx src/cli.ts commit --witness \\"stored offline\\""
echo "REAL-not-ZK: npx tsx src/cli.ts open --commitment <hex> --salt <salt> --witness \\"stored offline\\""
echo "SLOT:  npx tsx src/cli.ts groth16"
echo "Author: Aziel Eliab. Apache-2.0. Forks are always allowed."
`;
}

async function serveAsset(request, env, asset, { head = false } = {}) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return json({ error: "assets binding missing", asset }, 500);
  }
  const assetUrl = new URL("/" + asset, request.url);
  const assetRes = await env.ASSETS.fetch(new Request(assetUrl, { method: "GET" }));
  if (!assetRes.ok) {
    return json({ error: "asset not hosted", asset, status: assetRes.status }, 404);
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/gzip");
  headers.set("Content-Disposition", `attachment; filename="${asset}"`);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Zkattest-Asset", asset);
  headers.set("X-Zkattest-Honesty", "REAL-sha256; open=REAL-not-ZK; groth16=SLOT");
  const len = assetRes.headers.get("Content-Length");
  if (len) headers.set("Content-Length", len);
  for (const [key, value] of Object.entries(corsHeaders())) headers.set(key, value);
  if (head) return new Response(null, { status: 200, headers });
  return new Response(assetRes.body, { status: 200, headers });
}

function resolveAsset(url, dims) {
  if (dims.asset) return knownAsset(dims.asset);
  if (url.pathname.startsWith("/download/")) {
    const fromPath = decodeURIComponent(url.pathname.slice("/download/".length).replace(/\/+$/, ""));
    return knownAsset(fromPath);
  }
  if (url.pathname === "/download" || url.pathname === "/go") return DEFAULT_ASSET;
  return null;
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const seo = handleSeoRoutes(request, url);
  if (seo) return seo;

  if ((url.pathname === "/install.sh" || url.pathname === "/install.sh/") && request.method === "GET") {
    return new Response(installScript(request.url), {
      status: 200,
      headers: {
        "Content-Type": "text/x-shellscript; charset=utf-8",
        "Cache-Control": "private, no-store",
        ...corsHeaders(),
      },
    });
  }

  const runtime = await handleRuntimeApi(request, url, env);
  if (runtime) return runtime;

  if (url.pathname === "/" && request.method === "GET") {
    await incrementViews(env, request);
    logEvent("view", { path: "/" });
    const html = renderHome(await collectStats(env, request));
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        ...corsHeaders(),
      },
    });
  }

  if (url.pathname === "/count" && request.method === "GET") {
    const stats = await collectStats(env, request);
    return json(shapeCountBody({
      project: PROJECT,
      views: stats.views || 0,
      downloads: stats.downloads || 0,
      total: stats.total || 0,
      views_human: stats.views_human,
      downloads_human: stats.downloads_human,
      botManagementAvailable: readBotManagement(request).available,
    }));
  }

  if (url.pathname === "/stats" && request.method === "GET") {
    return json(await collectStats(env, request));
  }

  if (url.pathname === "/event" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON body required" }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "JSON object required" }, 400);
    }
    const dims = parseDims(body);
    const count = await increment(env, dims, request);
    logEvent("event", { key: kvKey(dims), branch: dims.branch, fork: dims.fork });
    return json({
      ok: true,
      key: kvKey(dims),
      count,
      owner: dims.owner,
      repo: dims.repo,
      branch: dims.branch,
      fork: dims.fork,
      asset: dims.asset || null,
    });
  }

  const downloadPath = url.pathname === "/download"
    || url.pathname.startsWith("/download/")
    || url.pathname === "/go";
  if (downloadPath && (request.method === "GET" || request.method === "HEAD")) {
    const dims = parseDims(url.searchParams);
    const asset = resolveAsset(url, dims);
    if (!asset) {
      let requested = dims.asset || null;
      if (!requested && url.pathname.startsWith("/download/")) {
        requested = decodeURIComponent(url.pathname.slice("/download/".length).replace(/\/+$/, "")) || null;
      }
      return json({
        error: "asset not hosted",
        asset: requested,
        hosted: DEFAULT_ASSET,
        note: "This Worker serves zkattest-0.1.0.tar.gz built from the repository. No other build is published.",
      }, 404);
    }
    dims.asset = asset;
    if (request.method === "GET") {
      await increment(env, dims, request);
      logEvent("download", { asset, branch: dims.branch, fork: dims.fork, owner: dims.owner, repo: dims.repo });
    }
    return serveAsset(request, env, asset, { head: request.method === "HEAD" });
  }

  return json({ error: "not found", product: PROJECT }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (exc) {
      console.error(JSON.stringify({
        event: "tracker_error",
        project: PROJECT,
        message: String(exc && exc.message ? exc.message : exc).slice(0, 300),
      }));
      return json({ error: "tracker_error", product: PROJECT }, 500);
    }
  },
};

export const TRACKER = {
  project: PROJECT,
  asset: DEFAULT_ASSET,
  host: HOST,
  version: "0.1.0",
  kv_title: "ZKATTEST_DOWNLOADS",
};
