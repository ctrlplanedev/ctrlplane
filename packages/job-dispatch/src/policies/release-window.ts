import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseIdPolicyChecker } from "./utils.js";
import { isDateInTimeWindow } from "../utils.js";

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the release window policy - the release window
 * policy defines the time window in which a release can be deployed.
 */
export const isPassingReleaseWindowPolicy: ReleaseIdPolicyChecker = async (
  db,
  releaseJobTriggers,
): Promise<schema.ReleaseJobTrigger[]> =>
  releaseJobTriggers.length === 0
    ? []
    : db
        .select()
        .from(schema.releaseJobTrigger)
        .innerJoin(
          schema.environment,
          eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
        )
        .leftJoin(
          schema.environmentPolicy,
          eq(schema.environment.policyId, schema.environmentPolicy.id),
        )
        .leftJoin(
          schema.environmentPolicyReleaseWindow,
          eq(
            schema.environmentPolicyReleaseWindow.policyId,
            schema.environmentPolicy.id,
          ),
        )
        .where(
          and(
            inArray(
              schema.releaseJobTrigger.id,
              releaseJobTriggers.map((t) => t.id).filter(isPresent),
            ),
            isNull(schema.environment.deletedAt),
          ),
        )
        .then((policies) =>
          _.chain(policies)
            .filter(
              ({ environment_policy_release_window }) =>
                environment_policy_release_window == null ||
                isDateInTimeWindow(
                  new Date(),
                  environment_policy_release_window.startTime,
                  environment_policy_release_window.endTime,
                  environment_policy_release_window.recurrence,
                ).isInWindow,
            )
            .map((m) => m.release_job_trigger)
            .uniqBy((m) => m.id)
            .value(),
        );
