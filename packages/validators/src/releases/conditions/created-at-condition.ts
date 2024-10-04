import { z } from "zod";

export const createdAtCondition = z.object({
  type: z.literal("created-at"),
  operator: z
    .literal("before")
    .or(z.literal("after"))
    .or(z.literal("before-or-on"))
    .or(z.literal("after-or-on")),
  value: z.string().refine((v) => !isNaN(new Date(v).getTime()), {
    message: "Invalid date",
  }),
});

export type CreatedAtCondition = z.infer<typeof createdAtCondition>;
