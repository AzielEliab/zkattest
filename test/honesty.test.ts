import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { HONESTY, HONESTY_INVARIANT } from "../src/honesty.ts";
import { HONESTY_INVARIANT as WORKER_INVARIANT } from "../workers/download-tracker/src/honesty.js";
import { LIMITATION } from "../src/engine.ts";
import { zkattestHealth, zkattestSkill } from "../src/ops.ts";

const root = new URL("..", import.meta.url);

function read(name: string): string {
  return readFileSync(new URL(name, root), "utf8");
}

describe("honesty invariant", () => {
  it("uses one sentence in the library, the worker, and the README", () => {
    assert.equal(WORKER_INVARIANT, HONESTY_INVARIANT);
    assert.match(HONESTY_INVARIANT, /commit and verify are a REAL SHA-256 salted-witness commitment/);
    assert.match(HONESTY_INVARIANT, /open is REAL-not-ZK and reveals the witness and the salt/);
    assert.match(HONESTY_INVARIANT, /Groth16, SNARK, and STARK proof systems are SLOT and are not implemented/);
    assert.match(HONESTY_INVARIANT, /never produces a ZK-SNARK proof/);
    for (const file of ["README.md", "SKILL.md", "NOTICE", "src/cli.ts", "src/engine.ts"]) {
      assert.ok(read(file).includes("REAL-not-ZK"), file + " missing REAL-not-ZK");
      assert.ok(read(file).includes("SLOT"), file + " missing SLOT");
    }
    assert.ok(read("README.md").includes(HONESTY_INVARIANT));
    assert.match(read("README.md"), /Forks are always allowed/);
    assert.match(read("README.md"), /Apache-2\.0/);
    assert.match(read("LICENSE"), /Apache License/);
    assert.match(read("LICENSE"), /Copyright 2026 Aziel Eliab/);
  });

  it("points the README at the tracker download and stats URLs", () => {
    const readme = read("README.md");
    assert.match(readme, /https:\/\/zkattest-download-tracker\.vibelock\.workers\.dev\/download/);
    assert.match(readme, /https:\/\/zkattest-download-tracker\.vibelock\.workers\.dev\/stats/);
    assert.match(readme, /active upon Cloudflare deploy/i);
    assert.match(readme, /npx tsx src\/cli\.ts commit/);
    assert.match(readme, /npx tsx src\/cli\.ts open/);
    assert.match(readme, /npx tsx src\/cli\.ts verify/);
    assert.doesNotMatch(readme, /ZK-SNARK proof (is|was) (included|attached|generated)/i);
  });

  it("maps proof systems to SLOT and the live ops to REAL or REAL-not-ZK", () => {
    assert.equal(HONESTY.commit, "REAL");
    assert.equal(HONESTY.attest, "REAL");
    assert.equal(HONESTY.verify, "REAL");
    assert.equal(HONESTY.open, "REAL-not-ZK");
    for (const op of ["groth16", "snark", "stark", "plonk", "bulletproofs", "prove", "full_zk", "zk_snark"]) {
      assert.equal(HONESTY[op as keyof typeof HONESTY], "SLOT");
    }
    assert.match(LIMITATION, /REAL-not-ZK/);
    assert.match(LIMITATION, /SLOT/);
    assert.match(LIMITATION, /never produces a ZK-SNARK proof/);
    const health = zkattestHealth();
    assert.equal(health.zk_system, false);
    assert.equal(health.groth16, "SLOT");
    assert.equal(health.open, "REAL-not-ZK");
    assert.equal(health.mesh_enabled_by_this_process, false);
    assert.equal(health.second_door, false);
    const skill = zkattestSkill();
    assert.match(skill.markdown, /REAL-not-ZK/);
    assert.match(skill.markdown, /SLOT/);
    assert.equal(skill.zk_system, false);
  });

  it("keeps the tracker config on a new ZKATTEST_DOWNLOADS placeholder", () => {
    const toml = read("workers/download-tracker/wrangler.toml");
    assert.match(toml, /name = "zkattest-download-tracker"/);
    assert.match(toml, /binding = "DOWNLOADS"/);
    assert.match(toml, /ZKATTEST_DOWNLOADS/);
    assert.match(toml, /id = "00000000000000000000000000000000"/);
    assert.doesNotMatch(toml, /24454c5285d7443f846a70e3d124c877/);
    assert.doesNotMatch(toml, /816b8d5da5fd470f9c4e783f3c87ca77/);
    assert.match(toml, /\[observability\.traces\]/);
    assert.match(toml, /enabled = true/);
  });
});
