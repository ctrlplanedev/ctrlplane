import { z } from "zod";

import agentConnect from "./agent-connect";
import agentHeartbeat from "./agent-heartbeat";
import sessionCreate from "./session-create";
import sessionDelete from "./session-delete";
import sessionInput from "./session-input";
import sessionOutput from "./session-output";

export type AgentHeartbeat = z.infer<typeof agentHeartbeat>;
export type AgentConnect = z.infer<typeof agentConnect>;
export type SessionCreate = z.infer<typeof sessionCreate>;
export type SessionInput = z.infer<typeof sessionInput>;
export type SessionOutput = z.infer<typeof sessionOutput>;
export type SessionDelete = z.infer<typeof sessionDelete>;

export {
  agentConnect,
  agentHeartbeat,
  sessionCreate,
  sessionDelete,
  sessionInput,
  sessionOutput,
};
