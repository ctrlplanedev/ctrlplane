// Client-safe exports only - no database imports
export { authClient, signIn, signOut, useSession } from "./client.js";

// Re-export type from server for convenience
export type { Session } from "./server.js";
