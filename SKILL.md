---
name: zkattest
description: >-
  Standalone SHA-256 salted-witness commitment (ZK-ATTEST-0.1).
  open is REAL-not-ZK. Groth16, SNARK, and STARK are SLOT.
  Author Aziel Eliab. Forks always allowed.
---

# zkattest

Commit without publishing the witness. Opening is not a ZK proof.

HONESTY INVARIANT: commit and verify are a REAL SHA-256 salted-witness commitment. open is REAL-not-ZK and reveals the witness and the salt. Groth16, SNARK, and STARK proof systems are SLOT and are not implemented. This tool never produces a ZK-SNARK proof.

Author: Aziel Eliab. License: Apache-2.0. Forks are always allowed.
Version: 0.1.0
GitHub: https://github.com/AzielEliab/zkattest
Neighbor: https://github.com/AzielEliab/aziel-runtime

## CLI

```bash
npx tsx src/cli.ts commit --witness "stored offline" --salt 00112233445566778899aabbccddeeff
npx tsx src/cli.ts attest --statement "The archive hash is bound to this statement." --commitment a1e3819004b5c8ee5cb7c661f2c1b0cac6eb1548699ed5e5841465a09e2f0dc4
npx tsx src/cli.ts open --commitment a1e3819004b5c8ee5cb7c661f2c1b0cac6eb1548699ed5e5841465a09e2f0dc4 --salt 00112233445566778899aabbccddeeff --witness "stored offline"
npx tsx src/cli.ts verify --receipt receipt.json
npx tsx src/cli.ts groth16
```

`groth16` exits SLOT. No proof is produced.

Counted archive, active upon Cloudflare deploy: https://zkattest-download-tracker.vibelock.workers.dev/download

Stats, active upon Cloudflare deploy: https://zkattest-download-tracker.vibelock.workers.dev/stats
