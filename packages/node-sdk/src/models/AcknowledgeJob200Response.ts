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

import { mapValues } from "../runtime";

/**
 *
 * @export
 * @interface AcknowledgeJob200Response
 */
export interface AcknowledgeJob200Response {
  /**
   *
   * @type {boolean}
   * @memberof AcknowledgeJob200Response
   */
  success: boolean;
}

/**
 * Check if a given object implements the AcknowledgeJob200Response interface.
 */
export function instanceOfAcknowledgeJob200Response(
  value: object,
): value is AcknowledgeJob200Response {
  if (!("success" in value) || value["success"] === undefined) return false;
  return true;
}

export function AcknowledgeJob200ResponseFromJSON(
  json: any,
): AcknowledgeJob200Response {
  return AcknowledgeJob200ResponseFromJSONTyped(json, false);
}

export function AcknowledgeJob200ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): AcknowledgeJob200Response {
  if (json == null) {
    return json;
  }
  return {
    success: json["success"],
  };
}

export function AcknowledgeJob200ResponseToJSON(
  value?: AcknowledgeJob200Response | null,
): any {
  if (value == null) {
    return value;
  }
  return {
    success: value["success"],
  };
}
