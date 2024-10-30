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
 * @interface SetTargetRequestTarget
 */
export interface SetTargetRequestTarget {
  /**
   *
   * @type {string}
   * @memberof SetTargetRequestTarget
   */
  name?: string;
  /**
   *
   * @type {string}
   * @memberof SetTargetRequestTarget
   */
  version?: string;
  /**
   *
   * @type {string}
   * @memberof SetTargetRequestTarget
   */
  kind?: string;
  /**
   *
   * @type {string}
   * @memberof SetTargetRequestTarget
   */
  identifier?: string;
  /**
   *
   * @type {object}
   * @memberof SetTargetRequestTarget
   */
  config?: object;
  /**
   *
   * @type {{ [key: string]: string; }}
   * @memberof SetTargetRequestTarget
   */
  metadata?: { [key: string]: string };
  /**
   *
   * @type {object}
   * @memberof SetTargetRequestTarget
   */
  variables?: object;
}

/**
 * Check if a given object implements the SetTargetRequestTarget interface.
 */
export function instanceOfSetTargetRequestTarget(
  value: object,
): value is SetTargetRequestTarget {
  return true;
}

export function SetTargetRequestTargetFromJSON(
  json: any,
): SetTargetRequestTarget {
  return SetTargetRequestTargetFromJSONTyped(json, false);
}

export function SetTargetRequestTargetFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): SetTargetRequestTarget {
  if (json == null) {
    return json;
  }
  return {
    name: json["name"] == null ? undefined : json["name"],
    version: json["version"] == null ? undefined : json["version"],
    kind: json["kind"] == null ? undefined : json["kind"],
    identifier: json["identifier"] == null ? undefined : json["identifier"],
    config: json["config"] == null ? undefined : json["config"],
    metadata: json["metadata"] == null ? undefined : json["metadata"],
    variables: json["variables"] == null ? undefined : json["variables"],
  };
}

export function SetTargetRequestTargetToJSON(
  value?: SetTargetRequestTarget | null,
): any {
  if (value == null) {
    return value;
  }
  return {
    name: value["name"],
    version: value["version"],
    kind: value["kind"],
    identifier: value["identifier"],
    config: value["config"],
    metadata: value["metadata"],
    variables: value["variables"],
  };
}
