/**
 * ZK-ATTEST-0.1 honesty labels.
 *
 * HONESTY INVARIANT: commit and verify are a REAL SHA-256 salted-witness
 * commitment. open is REAL-not-ZK and reveals the witness and the salt.
 * Groth16, SNARK, and STARK proof systems are SLOT and are not implemented.
 * This tool never produces a ZK-SNARK proof.
 *
 * Author: Aziel Eliab. Identity is Aziel Eliab only.
 */

export const HONESTY_INVARIANT =
  "HONESTY INVARIANT: commit and verify are a REAL SHA-256 salted-witness commitment. open is REAL-not-ZK and reveals the witness and the salt. Groth16, SNARK, and STARK proof systems are SLOT and are not implemented. This tool never produces a ZK-SNARK proof.";

export const HONESTY = Object.freeze({
  commit: "REAL",
  attest: "REAL",
  verify: "REAL",
  open: "REAL-not-ZK",
  groth16: "SLOT",
  snark: "SLOT",
  stark: "SLOT",
  plonk: "SLOT",
  bulletproofs: "SLOT",
  pairing: "SLOT",
  trusted_setup: "SLOT",
  prove: "SLOT",
  full_zk: "SLOT",
  zk_snark: "SLOT",
  reveal_witness: "SLOT",
});

export type HonestyLabel = "REAL" | "REAL-not-ZK" | "SLOT";

export function honestyLabel(op: string): HonestyLabel {
  const key = String(op || "").toLowerCase();
  if (key === "open") return "REAL-not-ZK";
  if (key === "commit" || key === "attest" || key === "verify") return "REAL";
  if (key === "health" || key === "skill" || key === "doctor" || key === "limitation") return "REAL";
  return "SLOT";
}
