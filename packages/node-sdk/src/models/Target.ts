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

import type { GetTarget200ResponseVariablesInner } from "./GetTarget200ResponseVariablesInner";
import { mapValues } from "../runtime";
import {
  GetTarget200ResponseVariablesInnerFromJSON,
  GetTarget200ResponseVariablesInnerFromJSONTyped,
  GetTarget200ResponseVariablesInnerToJSON,
} from "./GetTarget200ResponseVariablesInner";

/**
 *
 * @export
 * @interface Target
 */
export interface Target {
  /**
   *
   * @type {string}
   * @memberof Target
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof Target
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof Target
   */
  version: string;
  /**
   *
   * @type {string}
   * @memberof Target
   */
  kind: string;
  /**
   *
   * @type {string}
   * @memberof Target
   */
  identifier: string;
  /**
   *
   * @type {string}
   * @memberof Target
   */
  workspaceId: string;
  /**
   *
   * @type {object}
   * @memberof Target
   */
  config: object;
  /**
   *
   * @type {{ [key: string]: string; }}
   * @memberof Target
   */
  metadata: { [key: string]: string };
  /**
   *
   * @type {Array<GetTarget200ResponseVariablesInner>}
   * @memberof Target
   */
  variables?: Array<GetTarget200ResponseVariablesInner>;
  /**
   *
   * @type {object}
   * @memberof Target
   */
  provider?: object;
}

/**
 * Check if a given object implements the Target interface.
 */
export function instanceOfTarget(value: object): value is Target {
  if (!("id" in value) || value["id"] === undefined) return false;
  if (!("name" in value) || value["name"] === undefined) return false;
  if (!("version" in value) || value["version"] === undefined) return false;
  if (!("kind" in value) || value["kind"] === undefined) return false;
  if (!("identifier" in value) || value["identifier"] === undefined)
    return false;
  if (!("workspaceId" in value) || value["workspaceId"] === undefined)
    return false;
  if (!("config" in value) || value["config"] === undefined) return false;
  if (!("metadata" in value) || value["metadata"] === undefined) return false;
  return true;
}

export function TargetFromJSON(json: any): Target {
  return TargetFromJSONTyped(json, false);
}

export function TargetFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): Target {
  if (json == null) {
    return json;
  }
  return {
    id: json["id"],
    name: json["name"],
    version: json["version"],
    kind: json["kind"],
    identifier: json["identifier"],
    workspaceId: json["workspaceId"],
    config: json["config"],
    metadata: json["metadata"],
    variables:
      json["variables"] == null
        ? undefined
        : (json["variables"] as Array<any>).map(
            GetTarget200ResponseVariablesInnerFromJSON,
          ),
    provider: json["provider"] == null ? undefined : json["provider"],
  };
}

export function TargetToJSON(value?: Target | null): any {
  if (value == null) {
    return value;
  }
  return {
    id: value["id"],
    name: value["name"],
    version: value["version"],
    kind: value["kind"],
    identifier: value["identifier"],
    workspaceId: value["workspaceId"],
    config: value["config"],
    metadata: value["metadata"],
    variables:
      value["variables"] == null
        ? undefined
        : (value["variables"] as Array<any>).map(
            GetTarget200ResponseVariablesInnerToJSON,
          ),
    provider: value["provider"],
  };
}
