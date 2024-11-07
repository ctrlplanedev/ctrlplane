import type { AgentSocket } from "./agent-socket";
import type { UserSocket } from "./user-socket";

export const agents = new Map<string, AgentSocket>();
export const users = new Map<string, UserSocket>();
