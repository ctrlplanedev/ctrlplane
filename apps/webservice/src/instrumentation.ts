export async function register() {
  // eslint-disable-next-line no-restricted-properties
  if (process.env.NEXT_RUNTIME === "nodejs")
    await import("./instrumentation.node");
}
