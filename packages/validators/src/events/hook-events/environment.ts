import { z } from "zod";

const environmentBaseEvent = z.object({
  createdAt: z.string().datetime(),
  payload: z.object({
    environmentId: z.string().uuid(),
  }),
});

export enum EnvironmentEvent {
  Deleted = "environment.deleted",
  Created = "environment.created",
}

export const environmentDeletedEvent = environmentBaseEvent.extend({
  type: z.literal(EnvironmentEvent.Deleted),
});
export type EnvironmentDeletedEvent = z.infer<typeof environmentDeletedEvent>;

export const environmentCreatedEvent = environmentBaseEvent.extend({
  type: z.literal(EnvironmentEvent.Created),
});
export type EnvironmentCreatedEvent = z.infer<typeof environmentCreatedEvent>;
