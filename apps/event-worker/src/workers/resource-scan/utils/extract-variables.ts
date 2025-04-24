import _ from "lodash";

/**
 * Extracts resource variables from metadata keys prefixed with "variable-"
 * Works with metadata from any provider (Google labels, AWS tags, Azure tags, etc.)
 * @param resources Array of resources to process
 * @returns Array of resources with variables extracted from metadata
 */
export const extractVariablesFromMetadata = (resources: Array<any>): Array<any> => {
  return _.map(resources, resource => {
    if (!resource.metadata) return resource;
    
    const variableEntries = _.pickBy(resource.metadata, (_value, key) => 
      key.startsWith('variable-') && key.replace('variable-', '').length > 0
    );
    
    if (_.isEmpty(variableEntries)) return resource;
    
    const variables = _.map(variableEntries, (rawValue, key) => {
      const variableKey = key.replace('variable-', '');
      const stringValue = String(rawValue);
      
      let typedValue: string | number | boolean = stringValue;
      if (stringValue === 'true') typedValue = true;
      else if (stringValue === 'false') typedValue = false;
      else if (!isNaN(Number(stringValue)) && stringValue.trim() !== '') typedValue = Number(stringValue);
      
      return {
        key: variableKey,
        value: typedValue,
        sensitive: false
      };
    });
    
    return {
      ...resource,
      variables
    };
  });
};

// Export the original function name for backwards compatibility
export const extractVariablesFromLabels = extractVariablesFromMetadata; 