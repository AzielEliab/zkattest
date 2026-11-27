/**
 * Tracker-facing copy of the ZK-ATTEST-0.1 honesty invariant.
 * Keep this sentence identical to src/honesty.ts.
 * Author: Aziel Eliab.
 */

export const HONESTY_INVARIANT =
  "HONESTY INVARIANT: commit and verify are a REAL SHA-256 salted-witness commitment. open is REAL-not-ZK and reveals the witness and the salt. Groth16, SNARK, and STARK proof systems are SLOT and are not implemented. This tool never produces a ZK-SNARK proof.";
