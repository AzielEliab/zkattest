/**
 * ZKAttest standalone ops. The engine artifact is ./engine.ts.
 * This process is the library and CLI. It is not a second FragGate door.
 * Author: Aziel Eliab.
 */

import { HONESTY_INVARIANT } from "./honesty.js";
import {
  AXES,
  AUTHOR,
  LIMITATION,
  LIVE_OPS,
  MOTTO,
  NAME,
  NEIGHBOR_GITHUB,
  NEIGHBORS,
  PRODUCT,
  PRODUCT_GITHUB,
  ROLE,
  SPEC,
  STUB_REFUSE,
  VERSION,
  attest,
  commit,
  limitationCite,
  openCommitment,
  stubRefusal,
  verifyReceipt,
  type Payload,
} from "./engine.js";

export const ZKATTEST_OPS = LIVE_OPS.slice();

function envelope() {
  return {
    product: PRODUCT,
    name: NAME,
    version: VERSION,
    spec: SPEC,
    role: ROLE,
    motto: MOTTO,
    axes: AXES,
    neighbors: NEIGHBORS,
    live_ops: LIVE_OPS,
    stub_ops: STUB_REFUSE,
    limitation: LIMITATION,
    invariant: HONESTY_INVARIANT,
    extra: {
      github: PRODUCT_GITHUB,
      neighbor_runtime: NEIGHBOR_GITHUB,
      zk_system: false,
      snark: false,
      groth16: "SLOT",
      open: "REAL-not-ZK",
      commit: "REAL",
      verify: "REAL",
      worker_home: null,
      in_runtime: false,
      domain: null,
      placement: "receipt-attest",
      forks: "always-allowed",
      license: "Apache-2.0",
      second_door: false,
    },
  };
}

export function zkattestHealth() {
  const spec = envelope();
  return {
    ...spec.extra,
    ok: true as const,
    op: "health" as const,
    status: "ok" as const,
    product: spec.product,
    name: spec.name,
    version: spec.version,
    spec: spec.spec,
    role: spec.role,
    motto: spec.motto,
    axes: spec.axes.slice(),
    neighbors: spec.neighbors.slice(),
    live_ops: spec.live_ops.slice(),
    stub_ops: spec.stub_ops.slice(),
    true_engine_runtime: true,
    zk_system: false as const,
    kv_increment: false,
    door: "fraggate",
    mesh_enabled_by_this_process: false,
    limitation: spec.limitation,
    invariant: spec.invariant,
    author: AUTHOR,
    identity: AUTHOR,
  };
}

export function zkattestDoctor() {
  const health = zkattestHealth();
  return {
    ...health,
    op: "doctor" as const,
    doctor: true,
    note: "ZKAttest doctor: commit, attest, and verify are REAL SHA-256 salted-witness commitment. open is REAL-not-ZK. Full ZK proving is SLOT. This process does not enable mesh and is not a second door.",
  };
}

export function zkattestSkill() {
  const spec = envelope();
  const markdown = `# ${NAME} (${SPEC})

Hash-commitment attest without returning the private witness. ${MOTTO}

${HONESTY_INVARIANT}

- Library: \`commit\`, \`attest\`, \`openCommitment\`, \`verifyReceipt\`
- CLI: \`zkattest commit\`, \`zkattest attest\`, \`zkattest open\`, \`zkattest verify\`
- Runtime neighbor (FragGate remains the door): \`fraggate_call\` with \`{ slug: "${PRODUCT}", op: "..." }\` on ${NEIGHBOR_GITHUB}
- This repository does not open a second executable door

LIVE_OPS: ${spec.live_ops.join(", ")}.

SLOT (refuse, not implemented): ${spec.stub_ops.join(", ")}.

Axes: ${spec.axes.join(", ")}.
Neighbors: ${spec.neighbors.join(", ")}.

Author: Aziel Eliab only.
License: Apache-2.0. Forks are always allowed.
Limitation: ${spec.limitation}
`;
  return {
    op: "skill" as const,
    markdown,
    skill: markdown,
    kv_increment: false,
    limitation: spec.limitation,
    invariant: HONESTY_INVARIANT,
    live_ops: spec.live_ops.slice(),
    stub_ops: spec.stub_ops.slice(),
    neighbors: spec.neighbors.slice(),
    axes: spec.axes.slice(),
    door: "fraggate",
    zk_system: false as const,
    mesh_enabled_by_this_process: false,
    author: AUTHOR,
    product: PRODUCT,
    name: NAME,
    version: VERSION,
    spec: SPEC,
    true_engine_runtime: true,
  };
}

export async function runZkattest(op: string, payload?: Payload) {
  const name = String(op || "");
  if (name === "health") return zkattestHealth();
  if (name === "skill") return zkattestSkill();
  if (name === "doctor") return zkattestDoctor();
  if (name === "limitation") return limitationCite();
  if (name === "commit") return commit(payload);
  if (name === "attest") return attest(payload);
  if (name === "open") return openCommitment(payload);
  if (name === "verify") return verifyReceipt(payload);
  if ((STUB_REFUSE as readonly string[]).includes(name)) return stubRefusal(name);
  return {
    ok: false as const,
    unsupported: true as const,
    op: name,
    code: "FG-UNKNOWN-OP",
    zk_system: false as const,
    error: "Unknown op. No proof was produced.",
    author: AUTHOR,
  };
}

export { LIMITATION, VERSION };
