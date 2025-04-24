import type { ResourceToUpsert } from "@ctrlplane/db/schema";
import _ from "lodash";

/**
 * Converts a string value to its appropriate type (boolean, number, or string)
 */
const convertToTypedValue = (
  stringValue: string,
): string | number | boolean => {
  if (stringValue === "true") return true;
  if (stringValue === "false") return false;
  const numValue = Number(stringValue);
  if (!isNaN(numValue) && stringValue.trim() !== "") return numValue;
  return stringValue;
};

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

          return {
            key: variableKey,
            value: convertToTypedValue(stringValue),
            sensitive: false,
          };
        })
        .value();

      return variables.length > 0 ? { ...resource, variables } : resource;
    })
    .value();
};

export const extractVariablesFromLabels = extractVariablesFromMetadata;
