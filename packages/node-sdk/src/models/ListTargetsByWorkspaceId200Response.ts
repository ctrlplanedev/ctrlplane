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

import type { Target } from "./Target";
import { mapValues } from "../runtime";
import { TargetFromJSON, TargetFromJSONTyped, TargetToJSON } from "./Target";

/**
 *
 * @export
 * @interface ListTargetsByWorkspaceId200Response
 */
export interface ListTargetsByWorkspaceId200Response {
  /**
   *
   * @type {Array<Target>}
   * @memberof ListTargetsByWorkspaceId200Response
   */
  items: Array<Target>;
  /**
   *
   * @type {number}
   * @memberof ListTargetsByWorkspaceId200Response
   */
  total: number;
}

/**
 * Check if a given object implements the ListTargetsByWorkspaceId200Response interface.
 */
export function instanceOfListTargetsByWorkspaceId200Response(
  value: object,
): value is ListTargetsByWorkspaceId200Response {
  if (!("items" in value) || value["items"] === undefined) return false;
  if (!("total" in value) || value["total"] === undefined) return false;
  return true;
}

export function ListTargetsByWorkspaceId200ResponseFromJSON(
  json: any,
): ListTargetsByWorkspaceId200Response {
  return ListTargetsByWorkspaceId200ResponseFromJSONTyped(json, false);
}

export function ListTargetsByWorkspaceId200ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): ListTargetsByWorkspaceId200Response {
  if (json == null) {
    return json;
  }
  return {
    items: (json["items"] as Array<any>).map(TargetFromJSON),
    total: json["total"],
  };
}

export function ListTargetsByWorkspaceId200ResponseToJSON(
  value?: ListTargetsByWorkspaceId200Response | null,
): any {
  if (value == null) {
    return value;
  }
  return {
    items: (value["items"] as Array<any>).map(TargetToJSON),
    total: value["total"],
  };
}
