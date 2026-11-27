/**
 * zkattest download-tracker read surface.
 *
 * /v1 and /mcp do not increment DOWNLOADS.
 * GET never enables mesh. FragGate stays the executable door.
 * This Worker does not run commit/open/verify and does not build a proof.
 *
 * commit / verify = REAL SHA-256 in the standalone CLI.
 * open = REAL-not-ZK. Groth16 / SNARK / STARK = SLOT.
 *
 * Author: Aziel Eliab only.
 */

import { classifyV1Path, doorTargetUrl } from "./door.js";
import { HONESTY_INVARIANT } from "./honesty.js";

const PRODUCT = "zkattest";
const NAME = "ZKAttest";
const VERSION = "0.1.0";
const SPEC = "ZK-ATTEST-0.1";
const AUTHOR = "Aziel Eliab";
const HOST = "https://zkattest-download-tracker.vibelock.workers.dev";
const GITHUB = "https://github.com/AzielEliab/zkattest";
const NEIGHBOR = "https://github.com/AzielEliab/aziel-runtime";
const CATALOG_MCP = "https://aziel-runtime.vibelock.workers.dev/mcp";
const FRAGGATE_CALL = "https://aziel-runtime.vibelock.workers.dev/v1/fraggate/call";
const MOTTO = "Commit without publishing the witness. Opening is not a ZK proof.";
const LIMITATION =
  "THIS IS: a hash-commitment attest helper (ZK-ATTEST-0.1). commit and verify are a REAL SHA-256 salted-witness commitment. attest binds a public statement to that commitment without returning the witness. open is REAL-not-ZK: it reveals the witness and the salt to the caller who supplied them (not zero-knowledge). THIS IS NOT: Groth16 / SNARK / STARK / PLONK / Bulletproofs, a pairing curve, a trusted setup, or a live cryptographic ZK proving system. Those proof systems are SLOT and are not implemented. This tool never produces a ZK-SNARK proof. FragGate remains the runtime door; this repository is the standalone library and CLI, not a second door. Forks are always allowed (Apache-2.0). Author: Aziel Eliab only.";

const LIVE_OPS = ["health", "skill", "doctor", "commit", "attest", "open", "verify", "limitation"];
const READ_OPS = ["health", "skill", "doctor", "limitation", "describe"];
const SLOT_OPS = [
  "groth16", "snark", "stark", "plonk", "bulletproofs", "pairing",
  "trusted_setup", "prove", "full_zk", "zk_snark", "reveal_witness",
];
const DOOR_NOTE =
  "This Worker serves the counted source archive and read-only status. It does not commit, open, verify, or build a proof. Those REAL commands run in the installed CLI. FragGate slug zkattest remains the runtime door. GET never enables mesh. /v1 and /mcp do not increment counters.";

const SKILL = `---
name: zkattest
description: >-
  Standalone SHA-256 salted-witness commitment (ZK-ATTEST-0.1).
  open is REAL-not-ZK. Groth16, SNARK, and STARK are SLOT.
  Author Aziel Eliab.
---

# zkattest

${MOTTO}

${HONESTY_INVARIANT}

Author: **Aziel Eliab**. Identity is Aziel Eliab only.
Version: ${VERSION}
Spec: ${SPEC}
GitHub: ${GITHUB}
Neighbor: ${NEIGHBOR}
Download tracker: ${HOST}/download
Archive: zkattest-0.1.0.tar.gz (built from this repository; package.json ${VERSION})
License: Apache-2.0. Forks are always allowed.

${DOOR_NOTE}

Always send \`User-Agent: Mozilla/5.0\`.

## CLI

\`\`\`bash
npx tsx src/cli.ts commit --witness "stored offline" --salt 00112233445566778899aabbccddeeff
npx tsx src/cli.ts attest --statement "public statement" --commitment <64-hex>
npx tsx src/cli.ts open --commitment <64-hex> --salt <salt> --witness "stored offline"
npx tsx src/cli.ts verify --receipt receipt.json
\`\`\`

\`commit\` and \`verify\` are REAL. \`open\` is REAL-not-ZK. \`groth16\` exits SLOT and produces no proof.

## This Worker

| Method | Path | What |
|--------|------|------|
| GET | \`/download\` | Counted gzip of zkattest-0.1.0.tar.gz. HTTP 200. No GitHub redirect. |
| GET | \`/go\` | Same archive. |
| GET | \`/count\` | Compact counts. Does not increment. |
| GET | \`/stats\` | Full counts. Does not increment. |
| GET | \`/v1/health\` | Tracker liveness. Does not increment. |
| GET | \`/v1/fraggate/*\` | PROXY to aziel-runtime. Not a second door. |
| GET | \`/v1/mesh\` | PROXY. Does not enable mesh. |
| GET, POST | \`/mcp\` | Read-only MCP. Does not increment. |

Catalog MCP: \`${CATALOG_MCP}\` with FragGate slug \`${PRODUCT}\`.
Catalog call: \`POST ${FRAGGATE_CALL}\` body \`{"slug":"zkattest","op":"health"}\`.

LIVE_OPS in the library and catalog: ${LIVE_OPS.map((op) => "`" + op + "`").join(", ")}.
SLOT on this Worker and in the library: ${SLOT_OPS.map((op) => "`" + op + "`").join(", ")}.
`;

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

function describeBody() {
  return {
    ok: true,
    product: PRODUCT,
    name: NAME,
    version: VERSION,
    spec: SPEC,
    author: AUTHOR,
    identity: "Aziel Eliab only",
    license: "Apache-2.0",
    forks: "always-allowed",
    github: GITHUB,
    neighbor: NEIGHBOR,
    motto: MOTTO,
    invariant: HONESTY_INVARIANT,
    surface: "download-tracker",
    asset: "zkattest-0.1.0.tar.gz",
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
    door: "fraggate",
    slug: PRODUCT,
    second_door: false,
    live_ops: LIVE_OPS,
    read_ops_here: READ_OPS,
    slot_ops: SLOT_OPS,
    agent_path: FRAGGATE_CALL,
    note: DOOR_NOTE,
  };
}

function healthBody() {
  return {
    ok: true,
    product: PRODUCT,
    name: NAME,
    version: VERSION,
    spec: SPEC,
    author: AUTHOR,
    surface: "download-tracker",
    zk_system: false,
    honesty_label: "REAL",
    open: "REAL-not-ZK",
    proof_systems: "SLOT",
    door: "fraggate",
    slug: PRODUCT,
    kv_increment: false,
    mesh_enabled_by_get: false,
    invariant: HONESTY_INVARIANT,
    note: DOOR_NOTE,
  };
}

function doctorBody() {
  return {
    ok: true,
    product: PRODUCT,
    version: VERSION,
    spec: SPEC,
    author: AUTHOR,
    identity: "Aziel Eliab only",
    worker_local: true,
    fraggate_live: false,
    asset: "zkattest-0.1.0.tar.gz",
    proofs_built_here: false,
    zk_system: false,
    note: "Read-only self-check. commit and verify are REAL SHA-256 in the CLI. open is REAL-not-ZK. Groth16, SNARK, and STARK are SLOT. This response does not enable mesh and does not produce a proof.",
  };
}

function slotRefusal(op) {
  return {
    ok: false,
    code: "FG-STUB",
    op,
    verdict: "REFUSE",
    honesty_label: "SLOT",
    zk_system: false,
    proof: null,
    door: "fraggate",
    slug: PRODUCT,
    error: op + " is SLOT and is not implemented. No Groth16, SNARK, or STARK proof was produced.",
    invariant: HONESTY_INVARIANT,
  };
}

function doorRefusal(op) {
  return {
    ok: false,
    code: "ZKATTEST-DOOR",
    op,
    honesty_label: op === "open" ? "REAL-not-ZK" : "REAL",
    zk_system: false,
    proof: null,
    door: "fraggate",
    slug: PRODUCT,
    agent_path: FRAGGATE_CALL,
    local: "npx tsx src/cli.ts " + op,
    note: "This Worker does not run `" + op + "`. Use the installed CLI, or POST FragGate with slug zkattest. Nothing was enabled and no proof was produced.",
  };
}

function openapiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "zkattest download tracker",
      version: VERSION,
      description: HONESTY_INVARIANT + " " + DOOR_NOTE,
      license: { name: "Apache-2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
    },
    servers: [{ url: HOST }],
    paths: {
      "/download": { get: { operationId: "downloadArchive", summary: "Counted zkattest-0.1.0.tar.gz (HTTP 200)", responses: { "200": { description: "gzip archive" } } } },
      "/go": { get: { operationId: "goArchive", summary: "Same counted archive", responses: { "200": { description: "gzip archive" } } } },
      "/stats": { get: { operationId: "stats", summary: "Full counters. Does not increment.", responses: { "200": { description: "stats JSON" } } } },
      "/count": { get: { operationId: "downloadCount", summary: "Compact counters. Does not increment.", responses: { "200": { description: "count JSON" } } } },
      "/event": { post: { operationId: "event", summary: "Record a branch or fork download", responses: { "200": { description: "event JSON" } } } },
      "/v1/health": { get: { operationId: "health", summary: "Tracker liveness. Does not increment.", responses: { "200": { description: "health" } } } },
      "/v1/fraggate/call": { post: { operationId: "fraggateCall", summary: "Proxy to aziel-runtime. Not a second door.", responses: { "200": { description: "upstream" } } } },
      "/mcp": { post: { operationId: "mcp", summary: "Read-only MCP. Does not increment.", responses: { "200": { description: "JSON-RPC" } } } },
    },
  };
}

function mcpTools() {
  return [
    { name: "zkattest_health", description: "Tracker liveness. Does not build a proof or enable mesh.", inputSchema: { type: "object", properties: {} } },
    { name: "zkattest_skill", description: "Skill markdown for zkattest 0.1.0. REAL vs REAL-not-ZK vs SLOT.", inputSchema: { type: "object", properties: {} } },
    { name: "zkattest_doctor", description: "Read-only self-check of this download tracker.", inputSchema: { type: "object", properties: {} } },
    { name: "zkattest_limitation", description: "Honesty text. Proof systems are SLOT.", inputSchema: { type: "object", properties: {} } },
    { name: "zkattest_describe", description: "Read-only describe of the commitment tool and this tracker.", inputSchema: { type: "object", properties: {} } },
  ];
}

function mcpInitialize() {
  return {
    protocolVersion: "2025-03-26",
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: "zkattest-download-tracker", version: VERSION },
    instructions: HONESTY_INVARIANT + " " + DOOR_NOTE + " Catalog MCP remains " + CATALOG_MCP + ".",
  };
}

function readTool(name) {
  if (name === "zkattest_health" || name === "health") return healthBody();
  if (name === "zkattest_skill" || name === "skill") return { skill: SKILL };
  if (name === "zkattest_doctor" || name === "doctor") return doctorBody();
  if (name === "zkattest_limitation" || name === "limitation") {
    return { ok: true, limitation: LIMITATION, version: VERSION, invariant: HONESTY_INVARIANT, zk_system: false };
  }
  if (name === "zkattest_describe" || name === "describe") return describeBody();
  return null;
}

async function handleMcp(request) {
  if (request.method === "GET" || request.method === "HEAD") {
    const docs = {
      product: PRODUCT,
      version: VERSION,
      spec: SPEC,
      author: AUTHOR,
      protocol: "mcp",
      door: "fraggate",
      slug: PRODUCT,
      catalog_mcp: CATALOG_MCP,
      tools: mcpTools().map((tool) => tool.name),
      zk_system: false,
      invariant: HONESTY_INVARIANT,
      note: DOOR_NOTE,
    };
    if (request.method === "HEAD") return new Response(null, { status: 200, headers: corsHeaders() });
    return json(docs);
  }
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const id = body && Object.prototype.hasOwnProperty.call(body, "id") ? body.id : null;
  const method = body && body.method;
  const params = (body && body.params) || {};
  if (method === "initialize") return json({ jsonrpc: "2.0", id, result: mcpInitialize() });
  if (method === "notifications/initialized" || method === "initialized") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
  if (method === "tools/list") return json({ jsonrpc: "2.0", id, result: { tools: mcpTools() } });
  if (method === "tools/call") {
    const name = params.name || "";
    if (SLOT_OPS.includes(String(name).replace(/^zkattest_/, ""))) {
      const op = String(name).replace(/^zkattest_/, "");
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(slotRefusal(op)) }],
        },
      });
    }
    const data = readTool(name);
    if (!data) {
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{
            type: "text",
            text: JSON.stringify({
              ok: false,
              code: "ZKATTEST-DOOR",
              error: "Unknown or non-local tool. Commit, open, and verify run in the CLI or through FragGate slug zkattest. No proof was produced.",
              agent_path: FRAGGATE_CALL,
              catalog_mcp: CATALOG_MCP,
              zk_system: false,
            }),
          }],
        },
      });
    }
    if (name === "zkattest_skill" || name === "skill") {
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: SKILL }] } });
    }
    return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] } });
  }
  return json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: "Method not found. Use initialize, tools/list, tools/call." },
  });
}

function runtimeFetcher(env) {
  if (env && env.AZIEL_RUNTIME && typeof env.AZIEL_RUNTIME.fetch === "function") return env.AZIEL_RUNTIME;
  return null;
}

async function proxyDoor(request, url, env) {
  const dest = doorTargetUrl(url.pathname, request.url, env);
  if (!dest) return json({ ok: false, error: "not a door path", path: url.pathname, door: "fraggate" }, 404);
  const headers = new Headers();
  const pass = ["content-type", "accept", "authorization", "user-agent", "mcp-protocol-version", "mcp-session-id"];
  for (const name of pass) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("user-agent") && !headers.has("User-Agent")) headers.set("User-Agent", "Mozilla/5.0 zkattest/0.1.0");
  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }
  try {
    const fetcher = runtimeFetcher(env);
    const res = fetcher ? await fetcher.fetch(dest, init) : await fetch(dest, init);
    const outHeaders = new Headers();
    const ctype = res.headers.get("content-type");
    if (ctype) outHeaders.set("content-type", ctype);
    for (const [key, value] of Object.entries(corsHeaders())) outHeaders.set(key, value);
    outHeaders.set("X-Aziel-Door", "proxy");
    outHeaders.set("X-Aziel-Door-Origin", dest);
    outHeaders.set("Cache-Control", "private, no-store");
    return new Response(res.body, { status: res.status, headers: outHeaders });
  } catch (exc) {
    console.error(JSON.stringify({
      event: "fraggate_proxy_failed",
      project: PRODUCT,
      message: String(exc && exc.message ? exc.message : exc).slice(0, 240),
    }));
    return json({
      ok: false,
      error: "fraggate_proxy_failed",
      detail: String(exc && exc.message ? exc.message : exc).slice(0, 240),
      origin: dest,
      agent_path: FRAGGATE_CALL,
      door: "fraggate",
      slug: PRODUCT,
      zk_system: false,
      note: "The proxy failed. Nothing was enabled on this Worker. No proof was produced.",
    }, 502);
  }
}

export async function handleRuntimeApi(request, url, env) {
  const stripped = url.pathname.replace(/\/+$/, "") || "/";
  if (stripped === "/mcp") return handleMcp(request);

  const classified = classifyV1Path(url.pathname);
  if (classified.kind === "door") return proxyDoor(request, url, env);

  const path = stripped;
  const isApi = path === "/v1" || path.startsWith("/v1/") || path === "/openapi.json";
  if (!isApi) return null;

  if (classified.kind === "multi") {
    return json({
      ok: false,
      error: "not a local op",
      code: "NOT_LOCAL_OP",
      path: classified.path,
      zk_system: false,
      note: "Local reads are a single /v1/{op} segment. FragGate and mesh paths proxy to aziel-runtime and do not increment downloads.",
    }, 404);
  }

  if (path === "/openapi.json" && request.method === "GET") return json(openapiSpec());
  if (path === "/v1" && request.method === "GET") {
    return json({
      ok: true,
      product: PRODUCT,
      version: VERSION,
      spec: SPEC,
      read_ops: READ_OPS,
      slot_ops: SLOT_OPS,
      door: "fraggate",
      zk_system: false,
      kv_increment: false,
      invariant: HONESTY_INVARIANT,
      note: DOOR_NOTE,
    });
  }
  if (request.method === "GET" && path === "/v1/health") return json(healthBody());
  if (request.method === "GET" && path === "/v1/skill") {
    return new Response(SKILL, {
      status: 200,
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "private, no-store", ...corsHeaders() },
    });
  }
  if (request.method === "GET" && path === "/v1/doctor") return json(doctorBody());
  if (request.method === "GET" && path === "/v1/limitation") {
    return json({ ok: true, product: PRODUCT, version: VERSION, author: AUTHOR, limitation: LIMITATION, invariant: HONESTY_INVARIANT, zk_system: false });
  }
  if (request.method === "GET" && path === "/v1/describe") return json(describeBody());

  if (classified.kind === "local" && classified.op) {
    const op = classified.op;
    if (SLOT_OPS.includes(op)) return json(slotRefusal(op), 501);
    if (request.method === "GET" && !READ_OPS.includes(op)) {
      return json({ ...doorRefusal(op), hint: "Use the CLI or FragGate. GET does not enable this op." }, 405);
    }
    if (request.method === "POST") return json(doorRefusal(op), 400);
    if (request.method !== "GET") return json({ ok: false, code: "ZKATTEST-METHOD", zk_system: false, note: "Method not allowed." }, 405);
  }

  return json({ error: "not found", product: PRODUCT, zk_system: false, note: DOOR_NOTE }, 404);
}

export const RUNTIME_TEXT = { LIMITATION, MOTTO, VERSION, DOOR_NOTE, HONESTY_INVARIANT, SPEC };
