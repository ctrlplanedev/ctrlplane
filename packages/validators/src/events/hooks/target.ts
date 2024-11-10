import { z } from "zod";

const deployment = z.object({ id: z.string().uuid(), name: z.string() });
const target = z.object({
  id: z.string().uuid(),
  name: z.string(),
  config: z.record(z.any()),
});

export const targetRemoved = z.object({
  action: z.literal("target.removed"),
  payload: z.object({ deployment, target }),
});
export type TargetRemoved = z.infer<typeof targetRemoved>;

export const targetDeleted = z.object({
  action: z.literal("target.deleted"),
  payload: z.object({ target }),
});
export type TargetDeleted = z.infer<typeof targetDeleted>;
