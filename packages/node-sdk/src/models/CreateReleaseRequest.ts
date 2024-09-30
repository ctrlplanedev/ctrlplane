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
 * @interface CreateReleaseRequest
 */
export interface CreateReleaseRequest {
  /**
   *
   * @type {string}
   * @memberof CreateReleaseRequest
   */
  version: string;
  /**
   *
   * @type {string}
   * @memberof CreateReleaseRequest
   */
  deploymentId: string;
  /**
   *
   * @type {object}
   * @memberof CreateReleaseRequest
   */
  metadata?: object;
}

/**
 * Check if a given object implements the CreateReleaseRequest interface.
 */
export function instanceOfCreateReleaseRequest(
  value: object,
): value is CreateReleaseRequest {
  if (!("version" in value) || value["version"] === undefined) return false;
  if (!("deploymentId" in value) || value["deploymentId"] === undefined)
    return false;
  return true;
}

export function CreateReleaseRequestFromJSON(json: any): CreateReleaseRequest {
  return CreateReleaseRequestFromJSONTyped(json, false);
}

export function CreateReleaseRequestFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): CreateReleaseRequest {
  if (json == null) {
    return json;
  }
  return {
    version: json["version"],
    deploymentId: json["deploymentId"],
    metadata: json["metadata"] == null ? undefined : json["metadata"],
  };
}

export function CreateReleaseRequestToJSON(
  value?: CreateReleaseRequest | null,
): any {
  if (value == null) {
    return value;
  }
  return {
    version: value["version"],
    deploymentId: value["deploymentId"],
    metadata: value["metadata"],
  };
}