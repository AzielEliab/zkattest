import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { main } from "../src/cli.ts";
import { HONESTY_INVARIANT } from "../src/honesty.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

const SALT = "00112233445566778899aabbccddeeff";
const WITNESS = "witness-token-9f3a";

async function run(args: string[], stdinText = "") {
  const out = await main(args, { stdinText });
  return { ...out, json: out.stdout.trim().startsWith("{") ? JSON.parse(out.stdout) : null };
}

describe("zkattest CLI", () => {
  it("labels commit REAL and does not print the witness", async () => {
    const out = await run(["commit", "--witness", WITNESS, "--salt", SALT]);
    assert.equal(out.code, 0);
    assert.equal(out.json.honesty_label, "REAL");
    assert.equal(out.json.zk_system, false);
    assert.equal(out.json.proof_systems, "SLOT");
    assert.equal(out.json.invariant, HONESTY_INVARIANT);
    assert.equal(out.json.result.honesty, "REAL");
    assert.equal(out.json.result.witness_returned, false);
    assert.equal("witness" in out.json.result, false);
    assert.equal(out.stdout.includes(WITNESS), false);
    assert.match(out.stderr, /REAL: SHA-256 salted-witness commitment/);
    assert.match(out.stderr, /SLOT/);
  });

  it("labels open REAL-not-ZK and reveals the witness and the salt", async () => {
    const committed = await run(["commit", "--witness", WITNESS, "--salt", SALT]);
    const commitment = committed.json.result.commitment as string;
    const out = await run([
      "open",
      "--commitment",
      commitment,
      "--salt",
      SALT,
      "--witness",
      WITNESS,
    ]);
    assert.equal(out.code, 0);
    assert.equal(out.json.honesty_label, "REAL-not-ZK");
    assert.equal(out.json.zero_knowledge, false);
    assert.equal(out.json.revealed.witness, WITNESS);
    assert.equal(out.json.revealed.salt, SALT);
    assert.equal(out.json.result.verdict, "OPEN");
    assert.equal(out.json.result.honesty_label, "REAL-not-ZK");
    assert.equal(out.json.result.zero_knowledge, false);
    assert.match(out.stderr, /REAL-not-ZK/);
    assert.match(out.stderr, /not a ZK proof/);
    assert.match(out.stderr, /SLOT/);
  });

  it("labels verify REAL and does not recover the witness", async () => {
    const committed = await run(["commit", "--witness", WITNESS, "--salt", SALT]);
    const attested = await run([
      "attest",
      "--statement",
      "public statement",
      "--commitment",
      committed.json.result.commitment,
    ]);
    assert.equal(attested.code, 0);
    assert.equal(attested.json.honesty_label, "REAL");
    assert.equal(attested.stdout.includes(WITNESS), false);
    const dir = mkdtempSync(join(tmpdir(), "zkattest-"));
    const file = join(dir, "receipt.json");
    writeFileSync(file, JSON.stringify(attested.json.result.receipt));
    const verified = await run(["verify", "--receipt", file]);
    assert.equal(verified.code, 0);
    assert.equal(verified.json.honesty_label, "REAL");
    assert.equal(verified.json.result.verdict, "BOUND");
    assert.equal(verified.json.result.match, true);
    assert.equal(verified.stdout.includes(WITNESS), false);
    assert.match(verified.stderr, /REAL:/);
    assert.match(verified.stderr, /not recovered/);

    const piped = await run(["verify"], JSON.stringify({ receipt: attested.json.result.receipt }));
    assert.equal(piped.code, 0);
    assert.equal(piped.json.result.match, true);
  });

  it("refuses groth16, snark, and stark as SLOT with no proof", async () => {
    for (const op of ["groth16", "snark", "stark"]) {
      const out = await run([op]);
      assert.equal(out.code, 2);
      assert.equal(out.json.honesty_label, "SLOT");
      assert.equal(out.json.result.code, "FG-STUB");
      assert.equal(out.json.result.proof, null);
      assert.equal(out.json.result.zk_system, false);
      assert.match(out.stderr, /SLOT/);
      assert.match(out.stderr, /No ZK-SNARK proof was produced/);
      assert.doesNotMatch(out.stdout, /"proof":\s*"/);
    }
  });

  it("exits non-zero when attest is handed a witness or verify mismatches", async () => {
    const committed = await run(["commit", "--witness", WITNESS, "--salt", SALT]);
    const refused = await run([
      "attest",
      "--statement",
      "public",
      "--commitment",
      committed.json.result.commitment,
      "--witness",
      WITNESS,
    ]);
    assert.equal(refused.code, 1);
    assert.equal(refused.json.result.code, "WITNESS-NOT-ON-ATTEST");
    const mismatch = await run([
      "open",
      "--commitment",
      committed.json.result.commitment,
      "--salt",
      SALT,
      "--witness",
      "different-witness",
    ]);
    assert.equal(mismatch.code, 3);
    assert.equal(mismatch.json.honesty_label, "REAL-not-ZK");
    assert.equal(mismatch.json.result.verdict, "MISMATCH");
  });

  it("prints the invariant from help and from a built process", () => {
    const help = spawnSync(process.execPath, ["--import", "tsx", CLI, "--help"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /REAL-not-ZK/);
    assert.match(help.stdout, /SLOT/);
    assert.match(help.stdout, /Forks are always allowed/);

    const slot = spawnSync(process.execPath, ["--import", "tsx", CLI, "plonk"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(slot.status, 2);
    assert.match(slot.stdout, /"honesty_label": "SLOT"/);
    assert.match(slot.stderr, /No ZK-SNARK proof was produced/);
  });
});
