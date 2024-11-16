import { z } from "zod";

export default z
  .object({
    type: z
      .literal("agent.heartbeat")
      .describe("Type of payload - must be agent.heartbeat"),
    timestamp: z
      .string()
      .datetime({ offset: true })
      .describe("Timestamp of the heartbeat")
      .optional(),
  })
  .passthrough();
