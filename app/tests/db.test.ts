import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(path.join(APP, rel), "utf8");

function sourceFiles(dir = "src"): string[] {
  return readdirSync(path.join(APP, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "data" ? [] : sourceFiles(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

test("the secret-key client, the session client and the server settings are server-only", () => {
  for (const file of ["src/lib/db/admin.ts", "src/lib/db/server.ts", "src/lib/env-server.ts"]) {
    assert.match(read(file), /^import "server-only";/, `${file} starts with import "server-only"`);
  }
});

test("only the server settings and the admin client touch the Supabase secret key", () => {
  const readers = sourceFiles().filter((file) => read(file).includes("SUPABASE_SECRET_KEY"));
  assert.deepEqual(readers.sort(), ["src/lib/db/admin.ts", "src/lib/env-server.ts"]);
});

test("no Client Component imports a server-only database module", () => {
  for (const file of sourceFiles()) {
    const text = read(file);
    if (!/^["']use client["']/m.test(text)) continue;
    assert.doesNotMatch(text, /@\/lib\/(db\/admin|db\/server|env-server)["']/, `${file} is a Client Component`);
  }
});

test("the browser client uses only the publishable key", () => {
  const browser = read("src/lib/db/browser.ts");
  assert.match(browser, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(browser, /server-only|SECRET|service_role/i);
});
