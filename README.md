# zkattest

Standalone SHA-256 salted-witness commitment and verification tool (`ZK-ATTEST-0.1`), plus a Cloudflare download tracker. Author: **Aziel Eliab**. License: **Apache-2.0**. **Forks are always allowed.**

Motto: commit without publishing the witness. Opening is not a ZK proof.

**HONESTY INVARIANT: commit and verify are a REAL SHA-256 salted-witness commitment. open is REAL-not-ZK and reveals the witness and the salt. Groth16, SNARK, and STARK proof systems are SLOT and are not implemented. This tool never produces a ZK-SNARK proof.**

The same algorithm lives in [aziel-runtime](https://github.com/AzielEliab/aziel-runtime) (`src/engines/zkattest`, FragGate slug `zkattest`). This repository is the standalone library and CLI. It is not a second executable door. Neighbors: `forgereceipts`, `temporallock`. Schema: `zkattest.receipt.v0.1`.

## Honesty

| Op | Label | What it does |
| --- | --- | --- |
| `commit` | **REAL** | `sha256(JSON.stringify({ salt, witness }))`. A missing salt is 16 random bytes, hex-encoded. The witness is not returned. |
| `attest` | **REAL** | Binds a public statement to a 64-hex commitment and hashes that public body. Refuses a posted witness (`WITNESS-NOT-ON-ATTEST`). |
| `verify` | **REAL** | Recomputes the public receipt hash. Does not recover a witness. |
| `open` | **REAL-not-ZK** | Recomputes the commitment from the salt and witness the caller supplies, and reveals that witness and salt back to them. `zero_knowledge` is false. |
| `groth16`, `snark`, `stark`, `plonk`, `bulletproofs`, `pairing`, `trusted_setup`, `prove`, `full_zk`, `zk_snark` | **SLOT** | Not implemented. The CLI refuses them. No ZK-SNARK proof is produced. |

## Install

```bash
npm install
```

Node.js 20 or newer. The counted archive (HTTP 200, no GitHub redirect) is linked below and is active upon Cloudflare deploy.

## CLI

`commit` prints the commitment and the salt. It does not print the witness. `honesty_label` is `REAL`.

```bash
npx tsx src/cli.ts commit --witness "stored offline" --salt 00112233445566778899aabbccddeeff
```

```text
commitment: a1e3819004b5c8ee5cb7c661f2c1b0cac6eb1548699ed5e5841465a09e2f0dc4
algorithm:  sha256(json({salt,witness}))
```

`attest` binds a public statement to that commitment. The receipt does not contain the witness.

```bash
npx tsx src/cli.ts attest \
  --statement "The archive hash is bound to this statement." \
  --commitment a1e3819004b5c8ee5cb7c661f2c1b0cac6eb1548699ed5e5841465a09e2f0dc4
```

`verify` recomputes the receipt hash. Pass the receipt file, or pipe the JSON. This is REAL. It does not recover a witness.

```bash
npx tsx src/cli.ts verify --receipt receipt.json
```

`open` is REAL-not-ZK. The caller must already hold the witness and the salt. The CLI prints both of them again next to verdict `OPEN` or `MISMATCH`. A match is not a zero-knowledge proof.

```bash
npx tsx src/cli.ts open \
  --commitment a1e3819004b5c8ee5cb7c661f2c1b0cac6eb1548699ed5e5841465a09e2f0dc4 \
  --salt 00112233445566778899aabbccddeeff \
  --witness "stored offline"
```

Proof-system names are SLOT. This exits non-zero and does not emit a proof:

```bash
npx tsx src/cli.ts groth16
npx tsx src/cli.ts snark
npx tsx src/cli.ts stark
```

`health`, `skill`, `doctor`, and `limitation` print the same labels.

## Library

```ts
import { attest, commit, openCommitment, verifyReceipt } from "zkattest";

const committed = await commit({
  witness: "stored offline",
  salt: "00112233445566778899aabbccddeeff",
});
const bound = await attest({
  statement: "The archive hash is bound to this statement.",
  commitment: committed.commitment,
});
const checked = await verifyReceipt({ receipt: bound.receipt });
const opened = await openCommitment({
  commitment: committed.commitment,
  salt: committed.salt,
  witness: "stored offline",
});
```

`checked.match` is true when the public receipt is intact. `opened.honesty_label` is `REAL-not-ZK` and `opened.zero_knowledge` is false. Fields are capped at 64 KiB.

Canonical bytes are `JSON.stringify({ salt, witness })` with those keys in that order, hashed with SHA-256 and encoded as 64 hex characters.

## Download tracker

Worker name: `zkattest-download-tracker`.

These URLs are **active upon Cloudflare deploy**. This repository does not deploy the Worker, does not create the KV namespace, and does not merge itself. Cap-7 ≠ ICANN. Paid sat HELD. Remain-OFF.

- Download (HTTP 200 archive, counted): https://zkattest-download-tracker.vibelock.workers.dev/download
- Stats: https://zkattest-download-tracker.vibelock.workers.dev/stats

`GET /` counts a view. `GET /download` and `GET /go` count a download and return `zkattest-0.1.0.tar.gz`. `POST /event` records a branch or fork. `GET /stats` uses strategy (b): displayed bot counts are the remainder `total - human`, so pre-split history shows as bot and is never inflated. `/v1` and `/mcp` do not increment counters. CORS allows `*`.

The KV binding is `DOWNLOADS`. Deploy needs a **new** namespace titled `ZKATTEST_DOWNLOADS`. The id in `workers/download-tracker/wrangler.toml` is a placeholder. Do not reuse another product's namespace.

Source and local notes: `workers/download-tracker/README.md`.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Forks are always allowed. No extra permission is required to fork, modify, or redistribute this work under Apache-2.0.

Author: Aziel Eliab.
