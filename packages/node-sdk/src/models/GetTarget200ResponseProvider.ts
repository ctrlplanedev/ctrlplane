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
 * @interface GetTarget200ResponseProvider
 */
export interface GetTarget200ResponseProvider {
  /**
   *
   * @type {string}
   * @memberof GetTarget200ResponseProvider
   */
  id?: string;
  /**
   *
   * @type {string}
   * @memberof GetTarget200ResponseProvider
   */
  name?: string;
}

/**
 * Check if a given object implements the GetTarget200ResponseProvider interface.
 */
export function instanceOfGetTarget200ResponseProvider(
  value: object,
): value is GetTarget200ResponseProvider {
  return true;
}

export function GetTarget200ResponseProviderFromJSON(
  json: any,
): GetTarget200ResponseProvider {
  return GetTarget200ResponseProviderFromJSONTyped(json, false);
}

export function GetTarget200ResponseProviderFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetTarget200ResponseProvider {
  if (json == null) {
    return json;
  }
  return {
    id: json["id"] == null ? undefined : json["id"],
    name: json["name"] == null ? undefined : json["name"],
  };
}

export function GetTarget200ResponseProviderToJSON(
  json: any,
): GetTarget200ResponseProvider {
  return GetTarget200ResponseProviderToJSONTyped(json, false);
}

export function GetTarget200ResponseProviderToJSONTyped(
  value?: GetTarget200ResponseProvider | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    id: value["id"],
    name: value["name"],
  };
}
