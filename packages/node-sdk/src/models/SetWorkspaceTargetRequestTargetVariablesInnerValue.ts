/* tslint:disable */
/* eslint-disable */
/**
 * Ctrlplane API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 1.0.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

/**
 * @type SetWorkspaceTargetRequestTargetVariablesInnerValue
 *
 * @export
 */
export type SetWorkspaceTargetRequestTargetVariablesInnerValue =
  | boolean
  | number
  | string;

export function SetWorkspaceTargetRequestTargetVariablesInnerValueFromJSON(
  json: any,
): SetWorkspaceTargetRequestTargetVariablesInnerValue {
  return SetWorkspaceTargetRequestTargetVariablesInnerValueFromJSONTyped(
    json,
    false,
  );
}

export function SetWorkspaceTargetRequestTargetVariablesInnerValueFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): SetWorkspaceTargetRequestTargetVariablesInnerValue {
  if (json == null) {
    return json;
  }
  if (instanceOfboolean(json)) {
    return booleanFromJSONTyped(json, true);
  }
  if (instanceOfnumber(json)) {
    return numberFromJSONTyped(json, true);
  }
  if (instanceOfstring(json)) {
    return stringFromJSONTyped(json, true);
  }
}

export function SetWorkspaceTargetRequestTargetVariablesInnerValueToJSON(
  value?: SetWorkspaceTargetRequestTargetVariablesInnerValue | null,
): any {
  if (value == null) {
    return value;
  }

  if (instanceOfboolean(value)) {
    return booleanToJSON(value as boolean);
  }
  if (instanceOfnumber(value)) {
    return numberToJSON(value as number);
  }
  if (instanceOfstring(value)) {
    return stringToJSON(value as string);
  }

  return {};
}
