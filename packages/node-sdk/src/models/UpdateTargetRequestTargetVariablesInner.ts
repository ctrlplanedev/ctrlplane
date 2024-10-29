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

import type { GetTarget200ResponseVariablesInnerValue } from "./GetTarget200ResponseVariablesInnerValue";
import { mapValues } from "../runtime";
import {
  GetTarget200ResponseVariablesInnerValueFromJSON,
  GetTarget200ResponseVariablesInnerValueFromJSONTyped,
  GetTarget200ResponseVariablesInnerValueToJSON,
} from "./GetTarget200ResponseVariablesInnerValue";

/**
 *
 * @export
 * @interface UpdateTargetRequestTargetVariablesInner
 */
export interface UpdateTargetRequestTargetVariablesInner {
  /**
   *
   * @type {string}
   * @memberof UpdateTargetRequestTargetVariablesInner
   */
  key: string;
  /**
   *
   * @type {GetTarget200ResponseVariablesInnerValue}
   * @memberof UpdateTargetRequestTargetVariablesInner
   */
  value?: GetTarget200ResponseVariablesInnerValue | null;
  /**
   *
   * @type {boolean}
   * @memberof UpdateTargetRequestTargetVariablesInner
   */
  sensitive: boolean;
}

/**
 * Check if a given object implements the UpdateTargetRequestTargetVariablesInner interface.
 */
export function instanceOfUpdateTargetRequestTargetVariablesInner(
  value: object,
): value is UpdateTargetRequestTargetVariablesInner {
  if (!("key" in value) || value["key"] === undefined) return false;
  if (!("sensitive" in value) || value["sensitive"] === undefined) return false;
  return true;
}

export function UpdateTargetRequestTargetVariablesInnerFromJSON(
  json: any,
): UpdateTargetRequestTargetVariablesInner {
  return UpdateTargetRequestTargetVariablesInnerFromJSONTyped(json, false);
}

export function UpdateTargetRequestTargetVariablesInnerFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): UpdateTargetRequestTargetVariablesInner {
  if (json == null) {
    return json;
  }
  return {
    key: json["key"],
    value:
      json["value"] == null
        ? undefined
        : GetTarget200ResponseVariablesInnerValueFromJSON(json["value"]),
    sensitive: json["sensitive"],
  };
}

export function UpdateTargetRequestTargetVariablesInnerToJSON(
  value?: UpdateTargetRequestTargetVariablesInner | null,
): any {
  if (value == null) {
    return value;
  }
  return {
    key: value["key"],
    value: GetTarget200ResponseVariablesInnerValueToJSON(value["value"]),
    sensitive: value["sensitive"],
  };
}
