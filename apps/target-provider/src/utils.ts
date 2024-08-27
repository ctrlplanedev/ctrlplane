import type { Target } from "@ctrlplane/db/schema";

export function omitNullUndefined(obj: object) {
  return Object.entries(obj).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (value !== null && value !== undefined) acc[key] = value;
      return acc;
    },
    {},
  );
}

export type UpsertTarget = Pick<
  Target,
  | "version"
  | "name"
  | "kind"
  | "config"
  | "labels"
  | "providerId"
  | "identifier"
  | "workspaceId"
>;
