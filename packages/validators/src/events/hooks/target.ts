import { z } from "zod";

const deployment = z.object({ id: z.string().uuid(), name: z.string() });
const target = z.object({
  id: z.string().uuid(),
  name: z.string(),
  config: z.record(z.any()),
});

export const targetRemoved = z.object({
  event: z.literal("target"),
  action: z.literal("removed"),
  payload: z.object({ deployment, target }),
});
export type TargetRemoved = z.infer<typeof targetRemoved>;

export const targetDeleted = z.object({
  event: z.literal("target"),
  action: z.literal("deleted"),
  payload: z.object({ target }),
});
export type TargetDeleted = z.infer<typeof targetDeleted>;
