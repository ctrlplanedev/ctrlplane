import { z } from "zod";

export default z.object({
  type: z
    .literal("session.delete")
    .describe("Type of payload - must be session.create"),
  sessionId: z.string().describe("ID of the session to delete"),
});
