import { z } from "zod";

export default z.object({
  type: z
    .literal("session.input")
    .describe(
      "Type of payload - must be session.input to identify this as session input data",
    ),
  sessionId: z
    .string()
    .describe(
      "Unique identifier of the PTY session that should receive this input data",
    ),
  data: z
    .string()
    .describe(
      "The input data to send to the PTY session's standard input (stdin)",
    ),
});
