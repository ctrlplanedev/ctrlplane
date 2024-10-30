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

import type { SetTargetRequestTargetVariablesInnerValue } from "./SetTargetRequestTargetVariablesInnerValue";
import { mapValues } from "../runtime";
import {
  SetTargetRequestTargetVariablesInnerValueFromJSON,
  SetTargetRequestTargetVariablesInnerValueFromJSONTyped,
  SetTargetRequestTargetVariablesInnerValueToJSON,
} from "./SetTargetRequestTargetVariablesInnerValue";

/**
 *
 * @export
 * @interface TargetVariablesInner
 */
export interface TargetVariablesInner {
  /**
   *
   * @type {string}
   * @memberof TargetVariablesInner
   */
  key: string;
  /**
   *
   * @type {SetTargetRequestTargetVariablesInnerValue}
   * @memberof TargetVariablesInner
   */
  value?: SetTargetRequestTargetVariablesInnerValue | null;
  /**
   *
   * @type {boolean}
   * @memberof TargetVariablesInner
   */
  sensitive?: boolean;
}

/**
 * Check if a given object implements the TargetVariablesInner interface.
 */
export function instanceOfTargetVariablesInner(
  value: object,
): value is TargetVariablesInner {
  if (!("key" in value) || value["key"] === undefined) return false;
  return true;
}

export function TargetVariablesInnerFromJSON(json: any): TargetVariablesInner {
  return TargetVariablesInnerFromJSONTyped(json, false);
}

export function TargetVariablesInnerFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): TargetVariablesInner {
  if (json == null) {
    return json;
  }
  return {
    key: json["key"],
    value:
      json["value"] == null
        ? undefined
        : SetTargetRequestTargetVariablesInnerValueFromJSON(json["value"]),
    sensitive: json["sensitive"] == null ? undefined : json["sensitive"],
  };
}

export function TargetVariablesInnerToJSON(
  value?: TargetVariablesInner | null,
): any {
  if (value == null) {
    return value;
  }
  return {
    key: value["key"],
    value: SetTargetRequestTargetVariablesInnerValueToJSON(value["value"]),
    sensitive: value["sensitive"],
  };
}
