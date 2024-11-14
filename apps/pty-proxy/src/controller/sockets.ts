import type { AgentSocket } from "./agent-socket.js";
import type { UserSocket } from "./user-socket.js";

export const agents = new Map<string, AgentSocket>();
export const users = new Map<string, UserSocket>();
