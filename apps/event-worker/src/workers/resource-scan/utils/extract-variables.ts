import type { ResourceToInsert } from "@ctrlplane/job-dispatch";

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
  resources: ResourceToInsert[],
): ResourceToInsert[] => {
  return resources.map((resource) => {
    const variables = Object.entries(resource.metadata ?? {})
      .filter(
        ([key]) =>
          key.startsWith("variable-") && key.length > "variable-".length,
      )
      .map(([key, rawValue]) => ({
        key: key.slice("variable-".length),
        value: convertToTypedValue(String(rawValue)),
        sensitive: false,
      }));
      
    return { ...resource, variables };
  });
};
