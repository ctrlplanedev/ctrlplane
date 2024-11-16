import ms from "ms";

import { db } from "@ctrlplane/db/client";
import { deleteResources } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";

import type { AgentSocket } from "./agent-socket.js";
import type { UserSocket } from "./user-socket.js";

export const agents = new Map<string, { lastSync: Date; agent: AgentSocket }>();
export const users = new Map<string, UserSocket>();

setInterval(() => {
  const now = new Date();
  const staleThreshold = ms("15m"); // 15 minutes

  for (const [agentId, { lastSync, agent }] of agents.entries()) {
    const timeSinceSync = now.getTime() - lastSync.getTime();

    if (timeSinceSync > staleThreshold) {
      logger.info("Removing stale agent connection", {
        agentId,
        lastSync: lastSync.toISOString(),
        timeSinceSync: `${Math.round(timeSinceSync / 1000)}s`,
      });

      agent.socket.close(1000, "Agent connection timed out");
      agents.delete(agentId);
      deleteResources(db, [agentId]).then(() => {
        logger.info("Deleted stale agent resource", { agentId });
      });
    }
  }
}, ms("1m"));
