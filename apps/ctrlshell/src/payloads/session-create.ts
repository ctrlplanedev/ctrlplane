import { z } from "zod";

export default z.object({
  type: z
    .literal("session.create")
    .describe("Type of payload - must be session.create"),
  sessionId: z.string().describe("Optional ID for the session").optional(),
  username: z
    .string()
    .describe("Optional username for the session")
    .default(""),
  shell: z
    .string()
    .describe("Optional shell to use for the session")
    .default(""),
});
