import { z } from "zod";

export default z.object({
  type: z
    .literal("agent.connect")
    .describe("Type of payload - must be agent.register"),
  name: z.string().describe("Optional ID for the session"),
  config: z
    .record(z.any())
    .describe("Optional configuration for the agent")
    .optional(),
  metadata: z
    .record(z.string())
    .describe("Optional metadata for the agent as key-value string pairs")
    .optional(),
});
