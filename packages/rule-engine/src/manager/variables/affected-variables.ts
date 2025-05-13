import type * as schema from "@ctrlplane/db/schema";
import _ from "lodash";

export const getAffectedVariables = (
  previousVariables: (typeof schema.resourceVariable.$inferSelect)[],
  newVariables: (typeof schema.resourceVariable.$inferSelect)[],
) => {
  const previousVariablesMap = new Map(
    previousVariables.map((v) => [v.key, v]),
  );
  const newVariablesMap = new Map(newVariables.map((v) => [v.key, v]));

  const deletedVariables = previousVariables.filter(
    (v) => !newVariablesMap.has(v.key),
  );
  const createdVariables = newVariables.filter(
    (v) => !previousVariablesMap.has(v.key),
  );
  const updatedVariables = newVariables.filter((v) => {
    const previousVariable = previousVariablesMap.get(v.key);
    if (previousVariable == null) return false;

    return !_.isEqual(v, previousVariable);
  });

  return [...deletedVariables, ...createdVariables, ...updatedVariables];
};
