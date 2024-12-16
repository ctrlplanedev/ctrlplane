import { z } from "zod";

export default z.object({
  type: z
    .literal("session.create")
    .describe("Type of payload - must be session.create"),
  sessionId: z.string().describe("Optional ID for the session"),
  username: z.string().describe("Optional username for the session").optional(),
  shell: z
    .string()
    .describe("Optional shell to use for the session")
    .optional(),
  resourceId: z.string().describe("Resource ID for the session"),
  cols: z.number().describe("Number of columns for the session").optional(),
  rows: z.number().describe("Number of rows for the session").optional(),
});
