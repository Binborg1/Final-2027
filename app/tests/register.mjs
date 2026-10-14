// Registers the resolver that lets Node's test runner load the app's TypeScript modules directly.
import { register } from "node:module";

register("./resolve-hook.mjs", import.meta.url);
