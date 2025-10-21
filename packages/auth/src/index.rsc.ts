// Server-side exports for React Server Components
// This can safely import database and server-only code
export * from "./better/index.js"; // Client exports (types, etc)
export * from "./better/server.js"; // Server exports (auth, handlers, config)
