# zkattest download tracker

Worker name: `zkattest-download-tracker`.

This source is the landing page and the counted download. Tests do not deploy it, and a pull request does not deploy it. A deploy happens only after an explicit OK, with a new `ZKATTEST_DOWNLOADS` KV namespace. Cap-7 ≠ ICANN. Paid sat HELD. Remain-OFF.

Expected route after that deploy: `https://zkattest-download-tracker.vibelock.workers.dev/`

`GET /download` and `GET /go` return `public/zkattest-0.1.0.tar.gz` with HTTP 200 (`Content-Type: application/gzip`, `Content-Disposition: attachment`). The archive is the repository tree at package.json version **0.1.0**. There is no redirect to GitHub. Do not invent another version.

## Count

KV binding `DOWNLOADS`. Create namespace `ZKATTEST_DOWNLOADS` and replace the placeholder id in `wrangler.toml` before deploy. Do not reuse another product's namespace.

Key layout: `zkattest|owner|repo|branch|fork`.

`GET /` counts a page view. `GET /download` and `GET /go` count a download. `HEAD /download` does not. Totals on `GET /count` and `GET /stats` sum every branch and fork. Human/bot display uses strategy (b): `views_bot = views - views_human` and the same for downloads. The bot remainder is never inflated. `POST /event` records a fork or branch when the caller sends `{owner,repo,branch,fork}`.

`/v1`, `/mcp`, and `/v1/mesh/*` do not increment. GET never enables mesh. FragGate stays the executable door: `/v1/fraggate/*` and `/v1/mesh/*` proxy to aziel-runtime. This Worker does not run `commit`, `open`, or `verify`, and it does not build a Groth16, SNARK, or STARK proof (those are SLOT).

CORS: `Access-Control-Allow-Origin: *`.

## Local

```bash
cd workers/download-tracker
npm install
npx wrangler dev
```

Open the printed local URL. `GET /download` serves the archive from `public/`.

Rebuild the archive from the repository root:

```bash
node workers/download-tracker/scripts/pack-archive.mjs
```

The script pins mtime, owner, and gzip header so two packs of the same tree match.

Author: Aziel Eliab. Apache-2.0. Forks are always allowed.
