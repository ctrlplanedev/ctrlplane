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
 * @interface GetJob200Response
 */
export interface GetJob200Response {
  /**
   *
   * @type {string}
   * @memberof GetJob200Response
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200Response
   */
  status: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200Response
   */
  message: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200Response
   */
  jobAgentId: string;
  /**
   *
   * @type {object}
   * @memberof GetJob200Response
   */
  jobAgentConfig: object;
  /**
   *
   * @type {string}
   * @memberof GetJob200Response
   */
  externalRunId: string;
  /**
   *
   * @type {object}
   * @memberof GetJob200Response
   */
  release?: object;
  /**
   *
   * @type {object}
   * @memberof GetJob200Response
   */
  deployment?: object;
  /**
   *
   * @type {object}
   * @memberof GetJob200Response
   */
  config: object;
  /**
   *
   * @type {object}
   * @memberof GetJob200Response
   */
  runbook?: object;
  /**
   *
   * @type {object}
   * @memberof GetJob200Response
   */
  target?: object;
  /**
   *
   * @type {object}
   * @memberof GetJob200Response
   */
  environment?: object;
}

/**
 * Check if a given object implements the GetJob200Response interface.
 */
export function instanceOfGetJob200Response(
  value: object,
): value is GetJob200Response {
  if (!("id" in value) || value["id"] === undefined) return false;
  if (!("status" in value) || value["status"] === undefined) return false;
  if (!("message" in value) || value["message"] === undefined) return false;
  if (!("jobAgentId" in value) || value["jobAgentId"] === undefined)
    return false;
  if (!("jobAgentConfig" in value) || value["jobAgentConfig"] === undefined)
    return false;
  if (!("externalRunId" in value) || value["externalRunId"] === undefined)
    return false;
  if (!("config" in value) || value["config"] === undefined) return false;
  return true;
}

export function GetJob200ResponseFromJSON(json: any): GetJob200Response {
  return GetJob200ResponseFromJSONTyped(json, false);
}

export function GetJob200ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetJob200Response {
  if (json == null) {
    return json;
  }
  return {
    id: json["id"],
    status: json["status"],
    message: json["message"],
    jobAgentId: json["jobAgentId"],
    jobAgentConfig: json["jobAgentConfig"],
    externalRunId: json["externalRunId"],
    release: json["release"] == null ? undefined : json["release"],
    deployment: json["deployment"] == null ? undefined : json["deployment"],
    config: json["config"],
    runbook: json["runbook"] == null ? undefined : json["runbook"],
    target: json["target"] == null ? undefined : json["target"],
    environment: json["environment"] == null ? undefined : json["environment"],
  };
}

export function GetJob200ResponseToJSON(value?: GetJob200Response | null): any {
  if (value == null) {
    return value;
  }
  return {
    id: value["id"],
    status: value["status"],
    message: value["message"],
    jobAgentId: value["jobAgentId"],
    jobAgentConfig: value["jobAgentConfig"],
    externalRunId: value["externalRunId"],
    release: value["release"],
    deployment: value["deployment"],
    config: value["config"],
    runbook: value["runbook"],
    target: value["target"],
    environment: value["environment"],
  };
}
