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
 * @interface GetAgentRunningJob200ResponseInner
 */
export interface GetAgentRunningJob200ResponseInner {
  /**
   *
   * @type {string}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  status: string;
  /**
   *
   * @type {string}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  message: string;
  /**
   *
   * @type {string}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  jobAgentId: string;
  /**
   *
   * @type {object}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  jobAgentConfig: object;
  /**
   *
   * @type {string}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  externalRunId: string | null;
  /**
   *
   * @type {object}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  release?: object;
  /**
   *
   * @type {object}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  deployment?: object;
  /**
   *
   * @type {object}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  config: object;
  /**
   *
   * @type {object}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  runbook?: object;
  /**
   *
   * @type {object}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  target?: object;
  /**
   *
   * @type {object}
   * @memberof GetAgentRunningJob200ResponseInner
   */
  environment?: object;
}

/**
 * Check if a given object implements the GetAgentRunningJob200ResponseInner interface.
 */
export function instanceOfGetAgentRunningJob200ResponseInner(
  value: object,
): value is GetAgentRunningJob200ResponseInner {
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

export function GetAgentRunningJob200ResponseInnerFromJSON(
  json: any,
): GetAgentRunningJob200ResponseInner {
  return GetAgentRunningJob200ResponseInnerFromJSONTyped(json, false);
}

export function GetAgentRunningJob200ResponseInnerFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetAgentRunningJob200ResponseInner {
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

export function GetAgentRunningJob200ResponseInnerToJSON(
  value?: GetAgentRunningJob200ResponseInner | null,
): any {
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