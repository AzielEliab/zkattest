/**
 * zkattest download-tracker landing and discovery routes.
 * Counts are not incremented here. The caller decides.
 *
 * HONESTY INVARIANT: commit and verify are REAL SHA-256.
 * open is REAL-not-ZK. Groth16 / SNARK / STARK are SLOT.
 * Author: Aziel Eliab.
 */

import { HONESTY_INVARIANT } from "./honesty.js";

const HOST = "https://zkattest-download-tracker.vibelock.workers.dev";
const GITHUB = "https://github.com/AzielEliab/zkattest";

export const THEME = Object.freeze({
  dark: {
    bg: "#14120e",
    ink: "#f6f1e7",
    muted: "#d2c8b8",
    btnBg: "#f6f1e7",
    btnInk: "#14120e",
    focus: "#e2b657",
    line: "#3a342c",
  },
  light: {
    bg: "#f7f3ea",
    ink: "#1c1914",
    muted: "#4e483f",
    btnBg: "#1c1914",
    btnInk: "#f7f3ea",
    focus: "#8a5a00",
    line: "#d9d0c2",
  },
});

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function css() {
  const d = THEME.dark;
  const l = THEME.light;
  return `
    :root {
      color-scheme: dark;
      --bg: ${d.bg}; --ink: ${d.ink}; --muted: ${d.muted};
      --btn-bg: ${d.btnBg}; --btn-ink: ${d.btnInk}; --focus: ${d.focus}; --line: ${d.line};
    }
    @media (prefers-color-scheme: light) {
      :root {
        color-scheme: light;
        --bg: ${l.bg}; --ink: ${l.ink}; --muted: ${l.muted};
        --btn-bg: ${l.btnBg}; --btn-ink: ${l.btnInk}; --focus: ${l.focus}; --line: ${l.line};
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font: 18px/1.5 ui-sans-serif, system-ui, sans-serif;
      background: var(--bg); color: var(--ink);
    }
    main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    h1 { font-size: 2.25rem; line-height: 1.1; margin: 0 0 0.25rem; }
    h2 { font-size: 1.25rem; margin: 2rem 0 0.5rem; }
    p { margin: 0.6rem 0; }
    a { color: inherit; }
    a:focus-visible, button:focus-visible, .btn:focus-visible {
      outline: 3px solid var(--focus); outline-offset: 3px;
    }
    .btn {
      display: inline-block; margin: 0.75rem 0.75rem 0.75rem 0; padding: 0.7rem 1.1rem;
      background: var(--btn-bg); color: var(--btn-ink); text-decoration: none;
      border-radius: 999px; font-weight: 700;
    }
    .muted { color: var(--muted); }
    .counts { display: flex; gap: 1.5rem; margin: 1rem 0; }
    .counts strong { display: block; font-size: 1.8rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    th, td { text-align: left; padding: 0.45rem 0.4rem; border-bottom: 1px solid var(--line); vertical-align: top; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
  `;
}

export function renderHome(stats) {
  const views = Number(stats && stats.views) || 0;
  const downloads = Number(stats && stats.downloads) || 0;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>zkattest — ZK-ATTEST-0.1</title>
  <meta name="description" content="SHA-256 salted-witness commitment. open is REAL-not-ZK. Groth16, SNARK, and STARK are SLOT.">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>${css()}</style>
</head>
<body>
<main>
  <p class="muted">ZK-ATTEST-0.1 · Aziel Eliab · Apache-2.0 · forks always allowed</p>
  <h1>zkattest</h1>
  <p>Commit a witness with a salt. The commitment is a REAL SHA-256 digest. Opening it is REAL-not-ZK. Groth16, SNARK, and STARK proofs are SLOT.</p>
  <p class="muted">${esc(HONESTY_INVARIANT)}</p>
  <p>
    <a class="btn" id="download" href="/download">Download 0.1.0</a>
    <a class="btn" id="stats" href="/stats">Stats</a>
  </p>
  <div class="counts">
    <div><strong>${views}</strong><span class="muted">Views</span></div>
    <div><strong>${downloads}</strong><span class="muted">Downloads</span></div>
  </div>
  <h2>Honesty</h2>
  <table>
    <thead><tr><th>Op</th><th>Label</th><th>Meaning</th></tr></thead>
    <tbody>
      <tr><td><code>commit</code></td><td>REAL</td><td>SHA-256 of canonical JSON <code>{salt,witness}</code>. The witness is not returned.</td></tr>
      <tr><td><code>attest</code></td><td>REAL</td><td>Binds a public statement to a 64-hex commitment. A posted witness is refused.</td></tr>
      <tr><td><code>verify</code></td><td>REAL</td><td>Recomputes the public receipt hash. Does not recover a witness.</td></tr>
      <tr><td><code>open</code></td><td>REAL-not-ZK</td><td>Reveals the witness and the salt to the caller who supplied them.</td></tr>
      <tr><td><code>groth16</code> / <code>snark</code> / <code>stark</code></td><td>SLOT</td><td>Not implemented. This download does not include a proving system.</td></tr>
    </tbody>
  </table>
  <h2>Archive</h2>
  <p><code>GET /download</code> and <code>GET /go</code> return <code>zkattest-0.1.0.tar.gz</code> with HTTP 200. The file is the repository at package.json 0.1.0. There is no redirect to GitHub.</p>
  <p class="muted">Public host after Cloudflare deploy: <a href="${HOST}/">${esc(HOST)}/</a>. This repository does not deploy the Worker. <code>/v1</code> and <code>/mcp</code> do not increment counters.</p>
  <p><a href="${GITHUB}">${esc(GITHUB)}</a></p>
</main>
</body>
</html>
`;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, mcp-session-id, User-Agent, Authorization",
  };
}

function text(body, contentType) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      ...corsHeaders(),
    },
  });
}

function cite() {
  return {
    product: "zkattest",
    spec: "ZK-ATTEST-0.1",
    version: "0.1.0",
    author: "Aziel Eliab",
    license: "Apache-2.0",
    forks: "always-allowed",
    github: GITHUB,
    neighbor: "https://github.com/AzielEliab/aziel-runtime",
    download: HOST + "/download",
    stats: HOST + "/stats",
    honesty: {
      commit: "REAL",
      attest: "REAL",
      verify: "REAL",
      open: "REAL-not-ZK",
      groth16: "SLOT",
      snark: "SLOT",
      stark: "SLOT",
    },
    zk_system: false,
    invariant: HONESTY_INVARIANT,
    note: "Active upon Cloudflare deploy. This file does not deploy the Worker.",
  };
}

export function handleSeoRoutes(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/cite.json") {
    if (request.method === "HEAD") return new Response(null, { status: 200, headers: corsHeaders() });
    return text(JSON.stringify(cite(), null, 2) + "\n", "application/json; charset=utf-8");
  }
  if (path === "/robots.txt") {
    return text("User-agent: *\nAllow: /\n", "text/plain; charset=utf-8");
  }
  if (path === "/sitemap.xml") {
    const urls = ["/", "/download", "/stats", "/count", "/install.sh"].map((p) =>
      `  <url><loc>${HOST}${p}</loc></url>`,
    ).join("\n");
    return text(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, "application/xml; charset=utf-8");
  }
  if (path === "/llms.txt" || path === "/ai.txt") {
    const body = `# zkattest (ZK-ATTEST-0.1)

${HONESTY_INVARIANT}

Author: Aziel Eliab. License: Apache-2.0. Forks are always allowed.
Download (HTTP 200, after deploy): ${HOST}/download
Stats (after deploy): ${HOST}/stats
GitHub: ${GITHUB}
Neighbor runtime: https://github.com/AzielEliab/aziel-runtime
FragGate remains the executable door. This tracker does not enable mesh.
`;
    return text(body, "text/plain; charset=utf-8");
  }
  return null;
}
