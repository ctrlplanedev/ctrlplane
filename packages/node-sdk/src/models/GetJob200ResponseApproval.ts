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

import type { GetJob200ResponseApprovalApprover } from "./GetJob200ResponseApprovalApprover";
import { mapValues } from "../runtime";
import {
  GetJob200ResponseApprovalApproverFromJSON,
  GetJob200ResponseApprovalApproverFromJSONTyped,
  GetJob200ResponseApprovalApproverToJSON,
} from "./GetJob200ResponseApprovalApprover";

/**
 *
 * @export
 * @interface GetJob200ResponseApproval
 */
export interface GetJob200ResponseApproval {
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseApproval
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseApproval
   */
  status: GetJob200ResponseApprovalStatusEnum;
  /**
   *
   * @type {GetJob200ResponseApprovalApprover}
   * @memberof GetJob200ResponseApproval
   */
  approver?: GetJob200ResponseApprovalApprover;
}

/**
 * @export
 */
export const GetJob200ResponseApprovalStatusEnum = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
} as const;
export type GetJob200ResponseApprovalStatusEnum =
  (typeof GetJob200ResponseApprovalStatusEnum)[keyof typeof GetJob200ResponseApprovalStatusEnum];

/**
 * Check if a given object implements the GetJob200ResponseApproval interface.
 */
export function instanceOfGetJob200ResponseApproval(
  value: object,
): value is GetJob200ResponseApproval {
  if (!("id" in value) || value["id"] === undefined) return false;
  if (!("status" in value) || value["status"] === undefined) return false;
  return true;
}

export function GetJob200ResponseApprovalFromJSON(
  json: any,
): GetJob200ResponseApproval {
  return GetJob200ResponseApprovalFromJSONTyped(json, false);
}

export function GetJob200ResponseApprovalFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetJob200ResponseApproval {
  if (json == null) {
    return json;
  }
  return {
    id: json["id"],
    status: json["status"],
    approver:
      json["approver"] == null
        ? undefined
        : GetJob200ResponseApprovalApproverFromJSON(json["approver"]),
  };
}

export function GetJob200ResponseApprovalToJSON(
  value?: GetJob200ResponseApproval | null,
): any {
  if (value == null) {
    return value;
  }
  return {
    id: value["id"],
    status: value["status"],
    approver: GetJob200ResponseApprovalApproverToJSON(value["approver"]),
  };
}
