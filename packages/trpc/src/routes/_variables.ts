import type * as schema from "@ctrlplane/db/schema";

type VariableValueRow = typeof schema.variableValue.$inferSelect;

export const flattenVariableValue = (v: VariableValueRow): unknown => {
  if (v.kind === "literal") return v.literalValue;
  if (v.kind === "ref") return { reference: v.refKey, path: v.refPath ?? [] };
  return {
    provider: v.secretProvider,
    key: v.secretKey,
    path: v.secretPath ?? [],
  };
};

export const toClientVariableValue = (v: VariableValueRow) => ({
  id: v.id,
  deploymentVariableId: v.variableId,
  value: flattenVariableValue(v),
  resourceSelector: v.resourceSelector,
  priority: v.priority,
});
