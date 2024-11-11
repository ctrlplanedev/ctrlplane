import type { z } from "zod";

import agentConnect from "./agent-connect.js";
import agentHeartbeat from "./agent-heartbeat.js";
import sessionCreate from "./session-create.js";
import sessionDelete from "./session-delete.js";
import sessionInput from "./session-input.js";
import sessionOutput from "./session-output.js";
import sessionResize from "./session-resize.js";

export type AgentConnect = z.infer<typeof agentConnect>;
export type AgentHeartbeat = z.infer<typeof agentHeartbeat>;
export type SessionResize = z.infer<typeof sessionResize>;
export type SessionCreate = z.infer<typeof sessionCreate>;
export type SessionInput = z.infer<typeof sessionInput>;
export type SessionOutput = z.infer<typeof sessionOutput>;
export type SessionDelete = z.infer<typeof sessionDelete>;

export {
  agentConnect,
  agentHeartbeat,
  sessionResize,
  sessionCreate,
  sessionDelete,
  sessionInput,
  sessionOutput,
};
