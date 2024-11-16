import { z } from "zod";

export default z
  .object({
    type: z
      .literal("agent.heartbeat")
      .describe("Type of payload - must be agent.heartbeat"),
    timestamp: z
      .string()
      .datetime()
      .describe("Timestamp of the heartbeat in RFC3339 format")
      .optional(),
  })
  .passthrough();
