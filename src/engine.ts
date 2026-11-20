/**
 * ZKAttest — hash-commitment attest without returning the private witness.
 *
 * REAL: SHA-256 commitment of { salt, witness }. Public attest binds a
 * statement to that commitment. verify recomputes the public receipt hash.
 * open is REAL-not-ZK: it reveals the witness and the salt to the caller
 * who supplied them. zero_knowledge is false.
 *
 * SLOT (not implemented — this file never builds one):
 * Groth16, SNARK, STARK, PLONK, Bulletproofs, pairings, trusted setup.
 * This tool never produces a ZK-SNARK proof.
 *
 * Canonical commitment string: JSON.stringify({ salt, witness }).
 * Algorithm: sha256(json({salt,witness})).
 *
 * Author: Aziel Eliab. Identity is Aziel Eliab only.
 * Neighbor: https://github.com/AzielEliab/aziel-runtime (src/engines/zkattest).
 */

import { HONESTY_INVARIANT } from "./honesty.js";

export const PRODUCT = "zkattest";
export const NAME = "ZKAttest";
export const VERSION = "0.1.0";
export const ENGINE_VERSION = VERSION;
export const SPEC = "ZK-ATTEST-0.1";
export const AUTHOR = "Aziel Eliab";
export const MOTTO = "Commit without publishing the witness. Opening is not a ZK proof.";
export const ROLE = "hash-commitment attest (not a SNARK)";
export const SCHEMA = "zkattest.receipt.v0.1";
export const PRODUCT_GITHUB = "https://github.com/AzielEliab/zkattest";
export const NEIGHBOR_GITHUB = "https://github.com/AzielEliab/aziel-runtime";
export const MAX_FIELD_CHARS = 64 * 1024;
export { HONESTY_INVARIANT };

export const AXES = Object.freeze(["statement", "commitment", "opening"]);
export const NEIGHBORS = Object.freeze(["forgereceipts", "temporallock"]);
export const VERDICTS = Object.freeze(["COMMITTED", "BOUND", "OPEN", "MISMATCH", "REFUSE"]);

export const STUB_REFUSE = Object.freeze([
  "groth16",
  "snark",
  "stark",
  "plonk",
  "bulletproofs",
  "pairing",
  "trusted_setup",
  "prove",
  "full_zk",
  "zk_snark",
  "reveal_witness",
]);

export const LIMITATION =
  "THIS IS: a hash-commitment attest helper (ZK-ATTEST-0.1). commit and verify are a REAL SHA-256 salted-witness commitment. attest binds a public statement to that commitment without returning the witness. open is REAL-not-ZK: it reveals the witness and the salt to the caller who supplied them (not zero-knowledge). THIS IS NOT: Groth16 / SNARK / STARK / PLONK / Bulletproofs, a pairing curve, a trusted setup, or a live cryptographic ZK proving system. Those proof systems are SLOT and are not implemented. This tool never produces a ZK-SNARK proof. FragGate remains the runtime door; this repository is the standalone library and CLI, not a second door. Forks are always allowed (Apache-2.0). Author: Aziel Eliab only.";

export const LIVE_OPS = Object.freeze([
  "health",
  "skill",
  "doctor",
  "commit",
  "attest",
  "open",
  "verify",
  "limitation",
]);

export type Payload = Record<string, unknown> | null | undefined;

export class FieldLimitError extends Error {
  code = "SIZE_LIMIT";
  status = 400;
  constructor(name: string, length: number) {
    super(name + " exceeds size limit (" + length + " > " + MAX_FIELD_CHARS + " characters)");
    this.name = "FieldLimitError";
  }
}

function asStr(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function checkField(name: string, value: unknown): string {
  const text = value == null ? "" : String(value);
  if (text.length > MAX_FIELD_CHARS) throw new FieldLimitError(name, text.length);
  return text;
}

async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function canonicalizeCommit(salt: unknown, witness: unknown): string {
  return JSON.stringify({ salt: String(salt), witness: String(witness) });
}

export async function commitmentOf(salt: unknown, witness: unknown): Promise<string> {
  return sha256Hex(canonicalizeCommit(salt, witness));
}

function honesty() {
  return {
    honesty: "REAL" as const,
    kind: "hash-commitment",
    zk_system: false as const,
    snark: false as const,
    groth16: false as const,
    witness_returned: false as const,
    author: AUTHOR,
    identity: AUTHOR,
    door: "fraggate",
    invariant: HONESTY_INVARIANT,
  };
}

export async function commit(payload: Payload) {
  const witness = checkField("witness", payload && payload.witness);
  if (!witness) {
    return { ok: false as const, error: "witness is required", status: 400, ...honesty() };
  }
  const salt = checkField("salt", payload && payload.salt) || randomSalt();
  const commitment = await commitmentOf(salt, witness);
  return {
    ok: true as const,
    op: "commit" as const,
    schema: SCHEMA,
    product: PRODUCT,
    spec: SPEC,
    version: VERSION,
    commitment,
    salt,
    algorithm: "sha256(json({salt,witness}))",
    note: "Witness is not returned. Salt is returned to the committer so they can open later. This is a REAL SHA-256 salted-witness commitment, not a SNARK. Proof systems are SLOT.",
    ...honesty(),
  };
}

export async function attest(payload: Payload) {
  const statement = checkField("statement", payload && payload.statement);
  const commitment = checkField("commitment", payload && payload.commitment).toLowerCase();
  if (!statement) {
    return { ok: false as const, error: "statement is required", status: 400, ...honesty() };
  }
  if (!/^[a-f0-9]{64}$/.test(commitment)) {
    return { ok: false as const, error: "commitment must be 64-hex SHA-256", status: 400, ...honesty() };
  }
  if (payload && payload.witness != null && String(payload.witness) !== "") {
    return {
      ok: false as const,
      error: "attest refuses a posted witness — use commit then attest(commitment, statement)",
      status: 400,
      code: "WITNESS-NOT-ON-ATTEST",
      verdict: "REFUSE" as const,
      ...honesty(),
    };
  }
  const statement_hash = await sha256Hex(statement);
  const publicBody = {
    schema: SCHEMA,
    product: PRODUCT,
    spec: SPEC,
    statement,
    statement_hash,
    commitment,
    kind: "hash-commitment-attest",
    zk_system: false as const,
    author: AUTHOR,
  };
  const receipt_hash = await sha256Hex(JSON.stringify(publicBody));
  return {
    ok: true as const,
    op: "attest" as const,
    verdict: "BOUND" as const,
    receipt: { ...publicBody, receipt_hash },
    note: "Public receipt binds statement to commitment. Witness is not in this receipt. REAL SHA-256. Not a SNARK.",
    ...honesty(),
  };
}

export async function openCommitment(payload: Payload) {
  const commitment = checkField("commitment", payload && payload.commitment).toLowerCase();
  const salt = checkField("salt", payload && payload.salt);
  const witness = checkField("witness", payload && payload.witness);
  if (!/^[a-f0-9]{64}$/.test(commitment) || !salt || !witness) {
    return {
      ok: false as const,
      error: "open requires commitment, salt, and witness",
      status: 400,
      honesty_label: "REAL-not-ZK" as const,
      zero_knowledge: false as const,
      zk_system: false as const,
      author: AUTHOR,
      invariant: HONESTY_INVARIANT,
    };
  }
  const expected = await commitmentOf(salt, witness);
  const match = expected === commitment;
  return {
    ok: true as const,
    op: "open" as const,
    verdict: match ? ("OPEN" as const) : ("MISMATCH" as const),
    match,
    commitment,
    expected,
    honesty: "REAL" as const,
    honesty_label: "REAL-not-ZK" as const,
    kind: "commitment-opening",
    zk_system: false as const,
    zero_knowledge: false as const,
    reveals: ["witness", "salt"] as const,
    note: "REAL-not-ZK. Opening reveals the witness and the salt to the caller who supplied them. This is not a ZK proof. Groth16, SNARK, and STARK are SLOT.",
    author: AUTHOR,
    identity: AUTHOR,
    door: "fraggate",
    invariant: HONESTY_INVARIANT,
  };
}

export async function verifyReceipt(payload: Payload) {
  const source = payload && payload.receipt && typeof payload.receipt === "object"
    ? (payload.receipt as Record<string, unknown>)
    : (payload as Record<string, unknown> | null | undefined);
  if (!source || typeof source !== "object") {
    return { ok: false as const, error: "receipt object required", status: 400, ...honesty() };
  }
  const { receipt_hash, ...publicBody } = source;
  const expected = await sha256Hex(JSON.stringify(publicBody));
  const posted = asStr(receipt_hash).toLowerCase();
  const match = posted === expected;
  return {
    ok: true as const,
    op: "verify" as const,
    match,
    expected,
    posted,
    verdict: match ? ("BOUND" as const) : ("MISMATCH" as const),
    note: "REAL SHA-256. Recomputes the public receipt hash. Does not recover a witness. Not a SNARK.",
    ...honesty(),
  };
}

export function limitationCite() {
  return {
    ok: true as const,
    op: "limitation" as const,
    product: PRODUCT,
    spec: SPEC,
    version: VERSION,
    limitation: LIMITATION,
    invariant: HONESTY_INVARIANT,
    live_ops: LIVE_OPS.slice(),
    stub_ops: STUB_REFUSE.slice(),
    honesty_labels: {
      commit: "REAL",
      attest: "REAL",
      verify: "REAL",
      open: "REAL-not-ZK",
      groth16: "SLOT",
      snark: "SLOT",
      stark: "SLOT",
      full_zk: "SLOT",
    },
    out_of_scope: STUB_REFUSE.slice(),
    zk_system: false as const,
    author: AUTHOR,
    identity: AUTHOR,
    door: "fraggate",
    forks: "always-allowed",
    license: "Apache-2.0",
  };
}

export function stubRefusal(op: string) {
  return {
    ok: false as const,
    op,
    verdict: "REFUSE" as const,
    honesty_label: "SLOT" as const,
    code: "FG-STUB",
    status: 501,
    zk_system: false as const,
    snark: false as const,
    groth16: false as const,
    proof: null,
    error: op + " is SLOT and is not implemented. No Groth16, SNARK, or STARK proof was produced.",
    note: HONESTY_INVARIANT,
    author: AUTHOR,
    identity: AUTHOR,
  };
}
