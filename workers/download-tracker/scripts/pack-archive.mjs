import { execFileSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
export const ARCHIVE_NAME = "zkattest-0.1.0.tar.gz";
export const defaultArchivePath = resolve(root, "workers/download-tracker/public", ARCHIVE_NAME);

export function packArchive(out = defaultArchivePath) {
  const env = {
    ...process.env,
    SOURCE_DATE_EPOCH: "0",
  };
  delete env.GZIP;
  const scratch = mkdtempSync(join(tmpdir(), "zkattest-pack-"));
  const raw = join(scratch, "zkattest-0.1.0.tar");
  try {
    execFileSync(
      "tar",
      [
        "--sort=name",
        "--mtime=@0",
        "--owner=0",
        "--group=0",
        "--numeric-owner",
        "--format=gnu",
        "-cf",
        raw,
        "--exclude=.git",
        "--exclude=node_modules",
        "--exclude=dist",
        "--exclude=.wrangler",
        "--exclude=zkattest-0.1.0.tar.gz",
        "--exclude=*.log",
        "--transform",
        "s,^\\./,zkattest-0.1.0/,",
        "-C",
        root,
        ".",
      ],
      { stdio: "inherit", env },
    );
    const fd = openSync(out, "w");
    try {
      execFileSync("gzip", ["-n", "-c", raw], { stdio: ["ignore", fd, "inherit"], env });
    } finally {
      closeSync(fd);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return out;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  console.log(packArchive());
}
