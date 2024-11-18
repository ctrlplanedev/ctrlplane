import { z } from "zod";

const deployment = z.object({ id: z.string().uuid(), name: z.string() });
const resource = z.object({
  id: z.string().uuid(),
  name: z.string(),
  config: z.record(z.any()),
});

export const resourceRemoved = z.object({
  action: z.literal("deployment.resource.removed"),
  payload: z.object({ deployment, resource }),
});
export type ResourceRemoved = z.infer<typeof resourceRemoved>;
