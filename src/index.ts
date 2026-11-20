/**
 * zkattest public library (ZK-ATTEST-0.1).
 *
 * commit / attest / verify: REAL SHA-256 salted-witness commitment.
 * open: REAL-not-ZK (reveals witness + salt).
 * Groth16 / SNARK / STARK: SLOT. Never a ZK-SNARK proof.
 *
 * Author: Aziel Eliab. Forks are always allowed (Apache-2.0).
 */

export {
  AUTHOR,
  AXES,
  ENGINE_VERSION,
  HONESTY_INVARIANT,
  LIMITATION,
  LIVE_OPS,
  MAX_FIELD_CHARS,
  MOTTO,
  NAME,
  NEIGHBOR_GITHUB,
  NEIGHBORS,
  PRODUCT,
  PRODUCT_GITHUB,
  ROLE,
  SCHEMA,
  SPEC,
  STUB_REFUSE,
  VERDICTS,
  VERSION,
  attest,
  canonicalizeCommit,
  commit,
  commitmentOf,
  limitationCite,
  openCommitment,
  stubRefusal,
  verifyReceipt,
} from "./engine.js";

export { HONESTY, honestyLabel } from "./honesty.js";
export type { HonestyLabel } from "./honesty.js";

export { ZKATTEST_OPS, runZkattest, zkattestDoctor, zkattestHealth, zkattestSkill } from "./ops.js";
