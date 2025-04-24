import type { ResourceToUpsert } from "@ctrlplane/db/schema";
import _ from "lodash";

/**
 * Extracts resource variables from metadata keys prefixed with "variable-"
 * Works with metadata from any provider (Google labels, AWS tags, Azure tags, etc.)
 * @param resources Array of resources to process
 * @returns Array of resources with variables extracted from metadata
 */
export const extractVariablesFromMetadata = (
  resources: ResourceToUpsert[],
): ResourceToUpsert[] => {
  return _.chain(resources)
    .map((resource) => {
      if (!resource.metadata) return resource;
      const variables = _.chain(resource.metadata)
        .pickBy(
          (_value, key) =>
            key.startsWith("variable-") &&
            key.replace("variable-", "").length > 0,
        )
        .map((rawValue, key) => {
          const variableKey = key.replace("variable-", "");
          const stringValue = String(rawValue);

          let typedValue: string | number | boolean = stringValue;
          if (stringValue === "true") typedValue = true;
          else if (stringValue === "false") typedValue = false;
          else if (!isNaN(Number(stringValue)) && stringValue.trim() !== "")
            typedValue = Number(stringValue);

          return {
            key: variableKey,
            value: typedValue,
            sensitive: false,
          };
        })
        .value();
      return variables.length > 0 ? { ...resource, variables } : resource;
    })
    .value();
};

export const extractVariablesFromLabels = extractVariablesFromMetadata;
