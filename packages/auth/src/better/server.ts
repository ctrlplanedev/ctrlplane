// Server-only exports - includes database access
import type { auth } from "./config.js";

export * from "./config.js";
export { GET, POST } from "./route.js";
export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

