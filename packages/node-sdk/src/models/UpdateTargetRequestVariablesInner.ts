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

import type { UpdateTargetRequestVariablesInnerValue } from "./UpdateTargetRequestVariablesInnerValue";
import { mapValues } from "../runtime";
import {
  UpdateTargetRequestVariablesInnerValueFromJSON,
  UpdateTargetRequestVariablesInnerValueFromJSONTyped,
  UpdateTargetRequestVariablesInnerValueToJSON,
  UpdateTargetRequestVariablesInnerValueToJSONTyped,
} from "./UpdateTargetRequestVariablesInnerValue";

/**
 *
 * @export
 * @interface UpdateTargetRequestVariablesInner
 */
export interface UpdateTargetRequestVariablesInner {
  /**
   *
   * @type {string}
   * @memberof UpdateTargetRequestVariablesInner
   */
  key: string;
  /**
   *
   * @type {UpdateTargetRequestVariablesInnerValue}
   * @memberof UpdateTargetRequestVariablesInner
   */
  value: UpdateTargetRequestVariablesInnerValue;
  /**
   *
   * @type {boolean}
   * @memberof UpdateTargetRequestVariablesInner
   */
  sensitive?: boolean;
}

/**
 * Check if a given object implements the UpdateTargetRequestVariablesInner interface.
 */
export function instanceOfUpdateTargetRequestVariablesInner(
  value: object,
): value is UpdateTargetRequestVariablesInner {
  if (!("key" in value) || value["key"] === undefined) return false;
  if (!("value" in value) || value["value"] === undefined) return false;
  return true;
}

export function UpdateTargetRequestVariablesInnerFromJSON(
  json: any,
): UpdateTargetRequestVariablesInner {
  return UpdateTargetRequestVariablesInnerFromJSONTyped(json, false);
}

export function UpdateTargetRequestVariablesInnerFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): UpdateTargetRequestVariablesInner {
  if (json == null) {
    return json;
  }
  return {
    key: json["key"],
    value: UpdateTargetRequestVariablesInnerValueFromJSON(json["value"]),
    sensitive: json["sensitive"] == null ? undefined : json["sensitive"],
  };
}

export function UpdateTargetRequestVariablesInnerToJSON(
  json: any,
): UpdateTargetRequestVariablesInner {
  return UpdateTargetRequestVariablesInnerToJSONTyped(json, false);
}

export function UpdateTargetRequestVariablesInnerToJSONTyped(
  value?: UpdateTargetRequestVariablesInner | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    key: value["key"],
    value: UpdateTargetRequestVariablesInnerValueToJSON(value["value"]),
    sensitive: value["sensitive"],
  };
}