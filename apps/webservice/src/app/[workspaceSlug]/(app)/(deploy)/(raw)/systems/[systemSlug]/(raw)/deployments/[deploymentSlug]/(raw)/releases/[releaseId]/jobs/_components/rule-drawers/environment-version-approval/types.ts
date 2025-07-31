import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";

export type ApprovalState = NonNullable<
  RouterOutputs["policy"]["approval"]["byEnvironmentVersion"]
>;

export type MinimalUser = Pick<schema.User, "id" | "name" | "email" | "image">;
