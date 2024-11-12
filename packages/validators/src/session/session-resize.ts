import { z } from "zod";

export default z.object({
  type: z
    .literal("session.resize")
    .describe("Type of payload - must be session.resize"),
  targetId: z.string().describe("Target ID for the session"),
  sessionId: z.string().describe("ID of the session to resize"),
  cols: z.number().describe("New number of columns for the session"),
  rows: z.number().describe("New number of rows for the session"),
});
