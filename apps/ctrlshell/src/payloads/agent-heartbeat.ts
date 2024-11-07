import { z } from "zod";

export default z.object({
  id: z.string().describe("Unique identifier for the client"),
  type: z
    .literal("client.heartbeat")
    .describe("Type of payload - must be client.heartbeat"),
  timestamp: z
    .string()
    .datetime({ offset: true })
    .describe("Timestamp of the heartbeat")
    .optional(),
});
