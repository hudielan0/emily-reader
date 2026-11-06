// The double-click launcher: the reader ends up reachable, and running it again never starts a second copy.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/launch.sh", import.meta.url));
const launch = () => execFileSync("/bin/bash", [script], { env: { ...process.env, EMILY_READER_NO_OPEN: "1" }, timeout: 20_000 });
const listeners = () => {
  try {
    return execFileSync("lsof", ["-nP", "-tiTCP:8766", "-sTCP:LISTEN"]).toString().trim().split("\n").filter(Boolean).length;
  } catch {
    return 0; // lsof exits 1 when nothing listens
  }
};

describe("launch.sh", () => {
  it("leaves the reader running at 127.0.0.1:8766, only once, however often it is run", async () => {
    launch();
    launch();
    launch();
    const res = await fetch("http://127.0.0.1:8766/");
    expect(res.ok).toBe(true);
    expect(await res.text()).toContain("<title>Emily阅读</title>");
    expect(listeners()).toBe(1);
  }, 30_000);
});
