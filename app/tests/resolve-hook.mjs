// Resolves the "@/..." alias and extension-less relative imports to the TypeScript
// sources, so `node --test` can run the pure modules without a bundler.
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const extensions = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function locate(filePath) {
  if (existsSync(filePath) && statSync(filePath).isFile()) return filePath;
  for (const ext of extensions) if (existsSync(filePath + ext)) return filePath + ext;
  for (const ext of extensions) {
    const index = path.join(filePath, `index${ext}`);
    if (existsSync(index)) return index;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let filePath = null;
  if (specifier.startsWith("@/")) {
    filePath = path.join(src, specifier.slice(2));
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    filePath = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (filePath) {
    const found = locate(filePath);
    if (found) return nextResolve(pathToFileURL(found).href, context);
  }
  return nextResolve(specifier, context);
}
