#!/usr/bin/env node
/**
 * zkattest CLI (ZK-ATTEST-0.1).
 *
 * HONESTY INVARIANT: commit and verify are a REAL SHA-256 salted-witness
 * commitment. open is REAL-not-ZK and reveals the witness and the salt.
 * Groth16, SNARK, and STARK proof systems are SLOT and are not implemented.
 * This tool never produces a ZK-SNARK proof.
 *
 * Author: Aziel Eliab. Forks are always allowed (Apache-2.0).
 */

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HONESTY_INVARIANT, honestyLabel, type HonestyLabel } from "./honesty.js";
import { STUB_REFUSE, attest, commit, openCommitment, verifyReceipt } from "./engine.js";
import { runZkattest } from "./ops.js";

export interface CliIo {
  stdinText?: string;
}

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface Flags {
  [key: string]: string | boolean;
}

function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] ?? "";
    if (token === "--") continue;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next == null || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

function flagString(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  if (typeof value === "string") return value;
  return undefined;
}

function envelope(label: HonestyLabel, result: unknown, extra: Record<string, unknown> = {}) {
  return {
    honesty_label: label,
    zk_system: false,
    proof_systems: "SLOT",
    invariant: HONESTY_INVARIANT,
    ...extra,
    result,
  };
}

function stderrFor(op: string, label: HonestyLabel): string {
  if (label === "REAL-not-ZK") {
    return "REAL-not-ZK: witness and salt are revealed in this output. This is not a ZK proof. Groth16/SNARK/STARK are SLOT.\n";
  }
  if (label === "SLOT") {
    return "SLOT: " + op + " is not implemented. No ZK-SNARK proof was produced.\n";
  }
  if (op === "verify") {
    return "REAL: recomputed the public SHA-256 receipt hash. The witness was not recovered. Proof systems are SLOT.\n";
  }
  if (op === "commit" || op === "attest") {
    return "REAL: SHA-256 salted-witness commitment. The witness was not printed. Proof systems are SLOT.\n";
  }
  return "REAL status. zkattest does not produce a ZK-SNARK proof. Proof systems are SLOT.\n";
}

function finish(code: number, op: string, label: HonestyLabel, result: unknown, extra?: Record<string, unknown>): CliResult {
  const body = envelope(label, result, extra);
  return {
    code,
    stdout: JSON.stringify(body, null, 2) + "\n",
    stderr: stderrFor(op, label),
  };
}

function usage(): string {
  return `zkattest ${HONESTY_INVARIANT}

Usage:
  zkattest commit --witness <text> [--salt <hex>]
  zkattest attest --statement <text> --commitment <64-hex>
  zkattest open --commitment <64-hex> --salt <text> --witness <text>
  zkattest verify --receipt <file.json>
  zkattest verify                      (receipt JSON on stdin)
  zkattest health|skill|doctor|limitation
  zkattest groth16|snark|stark|...     (SLOT refusal, no proof)

commit, attest, and verify are REAL SHA-256. open is REAL-not-ZK.
Groth16, SNARK, and STARK are SLOT. Forks are always allowed (Apache-2.0).
Author: Aziel Eliab.
`;
}

async function readReceipt(flags: Flags, io: CliIo): Promise<unknown> {
  const path = flagString(flags, "receipt");
  const text = path ? readFileSync(path, "utf8") : (io.stdinText ?? "");
  if (!text.trim()) {
    const err = new Error("receipt JSON is required (--receipt file or stdin)");
    throw err;
  }
  return JSON.parse(text) as unknown;
}

export async function main(argv: string[], io: CliIo = {}): Promise<CliResult> {
  const { positional, flags } = parseArgs(argv);
  const op = (positional[0] || "").toLowerCase();

  if (!op || op === "help" || flags.help === true) {
    return { code: 0, stdout: usage(), stderr: "" };
  }

  if ((STUB_REFUSE as readonly string[]).includes(op)) {
    const result = await runZkattest(op, {});
    return finish(2, op, "SLOT", result);
  }

  try {
    if (op === "commit") {
      const witness = flagString(flags, "witness");
      const salt = flagString(flags, "salt");
      const result = await commit({ witness, salt });
      const code = result.ok ? 0 : 1;
      return finish(code, "commit", "REAL", result);
    }

    if (op === "attest") {
      const result = await attest({
        statement: flagString(flags, "statement"),
        commitment: flagString(flags, "commitment"),
        witness: flagString(flags, "witness"),
      });
      return finish(result.ok ? 0 : 1, "attest", "REAL", result);
    }

    if (op === "open") {
      const witness = flagString(flags, "witness") ?? "";
      const salt = flagString(flags, "salt") ?? "";
      const result = await openCommitment({
        commitment: flagString(flags, "commitment"),
        salt,
        witness,
      });
      const code = !result.ok ? 1 : result.verdict === "MISMATCH" ? 3 : 0;
      return finish(code, "open", "REAL-not-ZK", result, {
        zero_knowledge: false,
        revealed: { witness, salt },
      });
    }

    if (op === "verify") {
      const parsed = await readReceipt(flags, io);
      const receipt = parsed && typeof parsed === "object" && "receipt" in (parsed as Record<string, unknown>)
        ? (parsed as { receipt: unknown }).receipt
        : parsed;
      const result = await verifyReceipt({ receipt });
      const code = !result.ok ? 1 : result.verdict === "MISMATCH" ? 3 : 0;
      return finish(code, "verify", "REAL", result);
    }

    if (op === "health" || op === "skill" || op === "doctor" || op === "limitation") {
      const result = await runZkattest(op, {});
      return finish(0, op, honestyLabel(op), result);
    }

    const unknown = await runZkattest(op, {});
    return finish(1, op, "SLOT", unknown);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const code = (error as { code?: string }).code || "ERROR";
    return finish(1, op || "cli", honestyLabel(op), {
      ok: false,
      error: error.message,
      code,
      zk_system: false,
      proof: null,
    });
  }
}

function invokedDirectly(): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return realpathSync(arg) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  const stdinText = process.stdin.isTTY ? "" : readFileSync(0, "utf8");
  main(process.argv.slice(2), { stdinText }).then((out) => {
    if (out.stderr) process.stderr.write(out.stderr);
    process.stdout.write(out.stdout);
    process.exit(out.code);
  }).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write("SLOT: cli failed. No ZK-SNARK proof was produced. " + message + "\n");
    process.exit(1);
  });
}
