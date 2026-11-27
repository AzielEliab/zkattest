# Contributing

Forks are always allowed. zkattest is Apache-2.0.

Keep the honesty labels intact:

- `commit`, `attest`, and `verify` stay a REAL SHA-256 salted-witness commitment.
- `open` stays REAL-not-ZK. It reveals the witness and the salt the caller already holds.
- Groth16, SNARK, STARK, PLONK, Bulletproofs, pairings, and trusted setup stay SLOT. Do not add a proving system and describe it as present.

Author identity on this repository is Aziel Eliab only. FragGate on aziel-runtime remains the runtime door. This repository is not a second door.

Do not deploy `workers/download-tracker` from a pull request. A deploy needs an explicit OK, a new `ZKATTEST_DOWNLOADS` KV namespace, and the standing holds: Cap-7 ≠ ICANN, paid sat HELD, Remain-OFF.

Rebuild `workers/download-tracker/public/zkattest-0.1.0.tar.gz` with `npm run pack` when the tree changes, and commit the archive with the change.
