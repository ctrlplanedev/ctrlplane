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
 * @interface GetJob200ResponseRelease
 */
export interface GetJob200ResponseRelease {
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseRelease
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseRelease
   */
  version: string;
  /**
   *
   * @type {object}
   * @memberof GetJob200ResponseRelease
   */
  metadata: object;
  /**
   *
   * @type {object}
   * @memberof GetJob200ResponseRelease
   */
  config: object;
}

/**
 * Check if a given object implements the GetJob200ResponseRelease interface.
 */
export function instanceOfGetJob200ResponseRelease(
  value: object,
): value is GetJob200ResponseRelease {
  if (!("id" in value) || value["id"] === undefined) return false;
  if (!("version" in value) || value["version"] === undefined) return false;
  if (!("metadata" in value) || value["metadata"] === undefined) return false;
  if (!("config" in value) || value["config"] === undefined) return false;
  return true;
}

export function GetJob200ResponseReleaseFromJSON(
  json: any,
): GetJob200ResponseRelease {
  return GetJob200ResponseReleaseFromJSONTyped(json, false);
}

export function GetJob200ResponseReleaseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetJob200ResponseRelease {
  if (json == null) {
    return json;
  }
  return {
    id: json["id"],
    version: json["version"],
    metadata: json["metadata"],
    config: json["config"],
  };
}

export function GetJob200ResponseReleaseToJSON(
  json: any,
): GetJob200ResponseRelease {
  return GetJob200ResponseReleaseToJSONTyped(json, false);
}

export function GetJob200ResponseReleaseToJSONTyped(
  value?: GetJob200ResponseRelease | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    id: value["id"],
    version: value["version"],
    metadata: value["metadata"],
    config: value["config"],
  };
}
