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

import type { GetTarget200ResponseProvider } from "./GetTarget200ResponseProvider";
import { mapValues } from "../runtime";
import {
  GetTarget200ResponseProviderFromJSON,
  GetTarget200ResponseProviderFromJSONTyped,
  GetTarget200ResponseProviderToJSON,
  GetTarget200ResponseProviderToJSONTyped,
} from "./GetTarget200ResponseProvider";

/**
 *
 * @export
 * @interface GetTarget200Response
 */
export interface GetTarget200Response {
  /**
   *
   * @type {string}
   * @memberof GetTarget200Response
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof GetTarget200Response
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof GetTarget200Response
   */
  workspaceId: string;
  /**
   *
   * @type {string}
   * @memberof GetTarget200Response
   */
  kind: string;
  /**
   *
   * @type {string}
   * @memberof GetTarget200Response
   */
  identifier: string;
  /**
   *
   * @type {string}
   * @memberof GetTarget200Response
   */
  version: string;
  /**
   *
   * @type {{ [key: string]: any; }}
   * @memberof GetTarget200Response
   */
  config: { [key: string]: any };
  /**
   *
   * @type {Date}
   * @memberof GetTarget200Response
   */
  lockedAt?: Date;
  /**
   *
   * @type {Date}
   * @memberof GetTarget200Response
   */
  updatedAt: Date;
  /**
   *
   * @type {GetTarget200ResponseProvider}
   * @memberof GetTarget200Response
   */
  provider?: GetTarget200ResponseProvider;
  /**
   *
   * @type {{ [key: string]: string; }}
   * @memberof GetTarget200Response
   */
  metadata: { [key: string]: string };
}

/**
 * Check if a given object implements the GetTarget200Response interface.
 */
export function instanceOfGetTarget200Response(
  value: object,
): value is GetTarget200Response {
  if (!("id" in value) || value["id"] === undefined) return false;
  if (!("name" in value) || value["name"] === undefined) return false;
  if (!("workspaceId" in value) || value["workspaceId"] === undefined)
    return false;
  if (!("kind" in value) || value["kind"] === undefined) return false;
  if (!("identifier" in value) || value["identifier"] === undefined)
    return false;
  if (!("version" in value) || value["version"] === undefined) return false;
  if (!("config" in value) || value["config"] === undefined) return false;
  if (!("updatedAt" in value) || value["updatedAt"] === undefined) return false;
  if (!("metadata" in value) || value["metadata"] === undefined) return false;
  return true;
}

export function GetTarget200ResponseFromJSON(json: any): GetTarget200Response {
  return GetTarget200ResponseFromJSONTyped(json, false);
}

export function GetTarget200ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetTarget200Response {
  if (json == null) {
    return json;
  }
  return {
    id: json["id"],
    name: json["name"],
    workspaceId: json["workspaceId"],
    kind: json["kind"],
    identifier: json["identifier"],
    version: json["version"],
    config: json["config"],
    lockedAt: json["lockedAt"] == null ? undefined : new Date(json["lockedAt"]),
    updatedAt: new Date(json["updatedAt"]),
    provider:
      json["provider"] == null
        ? undefined
        : GetTarget200ResponseProviderFromJSON(json["provider"]),
    metadata: json["metadata"],
  };
}

export function GetTarget200ResponseToJSON(json: any): GetTarget200Response {
  return GetTarget200ResponseToJSONTyped(json, false);
}

export function GetTarget200ResponseToJSONTyped(
  value?: GetTarget200Response | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    id: value["id"],
    name: value["name"],
    workspaceId: value["workspaceId"],
    kind: value["kind"],
    identifier: value["identifier"],
    version: value["version"],
    config: value["config"],
    lockedAt:
      value["lockedAt"] == null ? undefined : value["lockedAt"].toISOString(),
    updatedAt: value["updatedAt"].toISOString(),
    provider: GetTarget200ResponseProviderToJSON(value["provider"]),
    metadata: value["metadata"],
  };
}
