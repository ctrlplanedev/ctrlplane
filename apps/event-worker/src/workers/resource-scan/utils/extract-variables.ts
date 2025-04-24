import type { ResourceToUpsert } from "@ctrlplane/db/schema";

const convertToTypedValue = (
  stringValue: string,
): string | number | boolean => {
  if (stringValue === "true") return true;
  if (stringValue === "false") return false;
  const numValue = Number(stringValue);
  if (stringValue.trim() !== "" && !isNaN(numValue)) return numValue;
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
  return resources.map((resource) => {
    if (!resource.metadata) return resource;

    const variableEntries = Object.entries(resource.metadata)
      .filter(([key]) => key.startsWith("variable-") && key.replace("variable-", "").length > 0);
    
    if (variableEntries.length === 0) return resource;
    
    const variables = variableEntries.map(([key, rawValue]) => ({
      key: key.replace("variable-", ""),
      value: convertToTypedValue(String(rawValue)),
      sensitive: false,
    }));

    return {
      ...resource,
      variables,
    };
  });
};