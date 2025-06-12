import _ from "lodash";

import type * as schema from "../../schema/index.js";

type ResourceWithVariablesAndMetadata = schema.Resource & {
  variables: (typeof schema.resourceVariable.$inferSelect)[];
  metadata: schema.ResourceMetadata[];
};

const normalizeResourceForComparison = (
  resource: ResourceWithVariablesAndMetadata,
) => {
  const { variables, metadata, id: __, updatedAt: ___, ...rest } = resource;
  const normalizedVariables = variables
    .map((v) => {
      const { id: __, resourceId: ___, ...rest } = v;
      return rest;
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const normalizedMetadata = metadata
    .map((m) => {
      const { id: __, resourceId: ___, ...rest } = m;
      return rest;
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    ...rest,
    variables: normalizedVariables,
    metadata: normalizedMetadata,
  };
};

export const isResourceChanged = (
  previous: ResourceWithVariablesAndMetadata,
  updated: ResourceWithVariablesAndMetadata,
) => {
  const previousNormalized = normalizeResourceForComparison(previous);
  const updatedNormalized = normalizeResourceForComparison(updated);

  return !_.isEqual(previousNormalized, updatedNormalized);
};
