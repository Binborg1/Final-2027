/**
 * Runs once when a server instance starts. Checks the environment variables, so a
 * deployment with a missing or malformed setting fails at once with the names of
 * what to fix (never their values).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { serverEnv } = await import("@/lib/env-server");
  serverEnv();
}
