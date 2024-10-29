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
 * @interface GetJob200ResponseCausedBy
 */
export interface GetJob200ResponseCausedBy {
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseCausedBy
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseCausedBy
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseCausedBy
   */
  email: string;
}

/**
 * Check if a given object implements the GetJob200ResponseCausedBy interface.
 */
export function instanceOfGetJob200ResponseCausedBy(
  value: object,
): value is GetJob200ResponseCausedBy {
  if (!("id" in value) || value["id"] === undefined) return false;
  if (!("name" in value) || value["name"] === undefined) return false;
  if (!("email" in value) || value["email"] === undefined) return false;
  return true;
}

export function GetJob200ResponseCausedByFromJSON(
  json: any,
): GetJob200ResponseCausedBy {
  return GetJob200ResponseCausedByFromJSONTyped(json, false);
}

export function GetJob200ResponseCausedByFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetJob200ResponseCausedBy {
  if (json == null) {
    return json;
  }
  return {
    id: json["id"],
    name: json["name"],
    email: json["email"],
  };
}

export function GetJob200ResponseCausedByToJSON(
  value?: GetJob200ResponseCausedBy | null,
): any {
  if (value == null) {
    return value;
  }
  return {
    id: value["id"],
    name: value["name"],
    email: value["email"],
  };
}
