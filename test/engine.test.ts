import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  MAX_FIELD_CHARS,
  SCHEMA,
  SPEC,
  STUB_REFUSE,
  attest,
  canonicalizeCommit,
  commit,
  commitmentOf,
  openCommitment,
  stubRefusal,
  verifyReceipt,
} from "../src/engine.ts";
import { runZkattest } from "../src/ops.ts";

const SALT = "00112233445566778899aabbccddeeff";
const WITNESS = "stored offline";
const STATEMENT = "The archive hash is bound to this statement.";
const COMMITMENT = "a1e3819004b5c8ee5cb7c661f2c1b0cac6eb1548699ed5e5841465a09e2f0dc4";
const RECEIPT_HASH = "5ccea95178ec3a3617bd5d5a823d3829a4c6a3c8b1683874fb4211fda1cb7ec4";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("ZK-ATTEST-0.1 commitment", () => {
  it("hashes the canonical {salt, witness} JSON and nothing else", async () => {
    const canonical = canonicalizeCommit(SALT, WITNESS);
    assert.equal(canonical, `{"salt":"${SALT}","witness":"${WITNESS}"}`);
    assert.equal(await commitmentOf(SALT, WITNESS), sha256(canonical));
    assert.equal(await commitmentOf(SALT, WITNESS), COMMITMENT);
    assert.equal(await commitmentOf(SALT, WITNESS), await commitmentOf(SALT, WITNESS));
  });

  it("changes the digest when the witness or the salt changes", async () => {
    const base = await commitmentOf(SALT, WITNESS);
    assert.notEqual(await commitmentOf(SALT, WITNESS + "x"), base);
    assert.notEqual(await commitmentOf(SALT + "aa", WITNESS), base);
  });

  it("commit is REAL, returns salt, and does not return the witness", async () => {
    const result = await commit({ witness: WITNESS, salt: SALT });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.op, "commit");
    assert.equal(result.commitment, COMMITMENT);
    assert.equal(result.salt, SALT);
    assert.equal(result.algorithm, "sha256(json({salt,witness}))");
    assert.equal(result.honesty, "REAL");
    assert.equal(result.zk_system, false);
    assert.equal(result.snark, false);
    assert.equal(result.groth16, false);
    assert.equal(result.witness_returned, false);
    assert.equal(result.spec, SPEC);
    assert.equal("witness" in result, false);
    assert.doesNotMatch(JSON.stringify(result), /stored offline/);
  });

  it("generates a 16-byte hex salt when one is omitted", async () => {
    const first = await commit({ witness: WITNESS });
    const second = await commit({ witness: WITNESS });
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.match(first.salt, /^[0-9a-f]{32}$/);
    assert.notEqual(first.salt, second.salt);
    assert.equal(first.commitment, await commitmentOf(first.salt, WITNESS));
    assert.equal("witness" in first, false);
  });

  it("rejects an empty witness and a field over 64 KiB", async () => {
    const missing = await commit({ witness: "" });
    assert.equal(missing.ok, false);
    await assert.rejects(() => commit({ witness: "a".repeat(MAX_FIELD_CHARS + 1), salt: SALT }));
    const edge = await commit({ witness: "b".repeat(MAX_FIELD_CHARS), salt: SALT });
    assert.equal(edge.ok, true);
  });

  it("hashes unicode witnesses as UTF-8", async () => {
    const witness = "snowman ☃";
    const result = await commit({ witness, salt: SALT });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.commitment, sha256(canonicalizeCommit(SALT, witness)));
  });
});

describe("attest, verify, and open", () => {
  it("binds a statement, refuses a posted witness, and verifies without recovering one", async () => {
    const refused = await attest({ statement: STATEMENT, commitment: COMMITMENT, witness: WITNESS });
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.code, "WITNESS-NOT-ON-ATTEST");
    assert.equal(refused.verdict, "REFUSE");
    assert.equal(refused.zk_system, false);

    const bound = await attest({ statement: STATEMENT, commitment: COMMITMENT.toUpperCase() });
    assert.equal(bound.ok, true);
    if (!bound.ok) return;
    assert.equal(bound.verdict, "BOUND");
    assert.equal(bound.receipt.commitment, COMMITMENT);
    assert.equal(bound.receipt.receipt_hash, RECEIPT_HASH);
    assert.equal(bound.receipt.zk_system, false);
    assert.equal(bound.receipt.schema, SCHEMA);
    assert.equal("witness" in bound.receipt, false);
    assert.equal("salt" in bound.receipt, false);

    const verified = await verifyReceipt({ receipt: bound.receipt });
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    assert.equal(verified.match, true);
    assert.equal(verified.verdict, "BOUND");
    assert.equal(verified.honesty, "REAL");
    assert.equal(verified.witness_returned, false);
    assert.equal("witness" in verified, false);

    const opened = await openCommitment({ commitment: COMMITMENT, salt: SALT, witness: WITNESS });
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    assert.equal(opened.verdict, "OPEN");
    assert.equal(opened.match, true);
    assert.equal(opened.honesty_label, "REAL-not-ZK");
    assert.equal(opened.zero_knowledge, false);
    assert.equal(opened.zk_system, false);
    assert.deepEqual(opened.reveals, ["witness", "salt"]);
    assert.match(opened.note, /REAL-not-ZK/);
    assert.match(opened.note, /SLOT/);
  });

  it("reports MISMATCH for a bad opening and a tampered receipt", async () => {
    const mismatch = await openCommitment({ commitment: COMMITMENT, salt: SALT, witness: "other" });
    assert.equal(mismatch.ok, true);
    if (!mismatch.ok) return;
    assert.equal(mismatch.verdict, "MISMATCH");
    assert.equal(mismatch.match, false);
    assert.equal(mismatch.honesty_label, "REAL-not-ZK");
    assert.equal(mismatch.zero_knowledge, false);

    const bound = await attest({ statement: STATEMENT, commitment: COMMITMENT });
    assert.equal(bound.ok, true);
    if (!bound.ok) return;
    const tampered = { ...bound.receipt, statement: STATEMENT + " edited" };
    const verified = await verifyReceipt({ receipt: tampered });
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    assert.equal(verified.verdict, "MISMATCH");
    assert.equal(verified.match, false);
    assert.equal("witness" in verified, false);
  });

  it("rejects a bad commitment, a missing statement, and an incomplete opening", async () => {
    const bad = await attest({ statement: STATEMENT, commitment: "abcd" });
    assert.equal(bad.ok, false);
    const empty = await attest({ statement: "", commitment: COMMITMENT });
    assert.equal(empty.ok, false);
    const open = await openCommitment({ commitment: COMMITMENT, salt: "", witness: WITNESS });
    assert.equal(open.ok, false);
    if (open.ok) return;
    assert.equal(open.honesty_label, "REAL-not-ZK");
    assert.equal(open.zero_knowledge, false);
  });
});

describe("SLOT proof systems", () => {
  it("refuses every stub op without emitting a proof", async () => {
    for (const op of STUB_REFUSE) {
      const result = await runZkattest(op, { witness: WITNESS });
      assert.equal(result.ok, false);
      if (!("honesty_label" in result)) {
        assert.fail(op + " missing honesty_label");
      }
      assert.equal(result.honesty_label, "SLOT");
      assert.equal(result.code, "FG-STUB");
      assert.equal(result.zk_system, false);
      assert.equal(result.proof, null);
      const direct = stubRefusal(op);
      assert.equal(direct.proof, null);
      assert.match(JSON.stringify(result), /not implemented/);
      assert.doesNotMatch(JSON.stringify(result), /proof_bytes|pi_a|vk_alpha/i);
    }
  });

  it("does not treat an unknown op as a successful proof", async () => {
    const result = await runZkattest("not_an_op", {});
    assert.equal(result.ok, false);
    if (!("code" in result)) assert.fail("missing code");
    assert.equal(result.code, "FG-UNKNOWN-OP");
    assert.equal(result.zk_system, false);
  });
});
