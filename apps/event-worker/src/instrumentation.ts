export async function register() {
  if (process.env.NODE_ENV === "production")
    await import("./instrumentation-node.js");
}
