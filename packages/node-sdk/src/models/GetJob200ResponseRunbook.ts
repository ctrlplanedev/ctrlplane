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
 * @interface GetJob200ResponseRunbook
 */
export interface GetJob200ResponseRunbook {
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseRunbook
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseRunbook
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseRunbook
   */
  systemId: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseRunbook
   */
  jobAgentId: string;
}

/**
 * Check if a given object implements the GetJob200ResponseRunbook interface.
 */
export function instanceOfGetJob200ResponseRunbook(
  value: object,
): value is GetJob200ResponseRunbook {
  if (!("id" in value) || value["id"] === undefined) return false;
  if (!("name" in value) || value["name"] === undefined) return false;
  if (!("systemId" in value) || value["systemId"] === undefined) return false;
  if (!("jobAgentId" in value) || value["jobAgentId"] === undefined)
    return false;
  return true;
}

export function GetJob200ResponseRunbookFromJSON(
  json: any,
): GetJob200ResponseRunbook {
  return GetJob200ResponseRunbookFromJSONTyped(json, false);
}

export function GetJob200ResponseRunbookFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetJob200ResponseRunbook {
  if (json == null) {
    return json;
  }
  return {
    id: json["id"],
    name: json["name"],
    systemId: json["systemId"],
    jobAgentId: json["jobAgentId"],
  };
}

export function GetJob200ResponseRunbookToJSON(
  json: any,
): GetJob200ResponseRunbook {
  return GetJob200ResponseRunbookToJSONTyped(json, false);
}

export function GetJob200ResponseRunbookToJSONTyped(
  value?: GetJob200ResponseRunbook | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    id: value["id"],
    name: value["name"],
    systemId: value["systemId"],
    jobAgentId: value["jobAgentId"],
  };
}
