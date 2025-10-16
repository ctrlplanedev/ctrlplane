import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { GoEventPayload, GoMessage } from "../events.js";
import { createSpanWrapper } from "../../span.js";
import { sendGoEvent } from "../client.js";
import { Event } from "../events.js";

const getOapiUserApprovalRecord = (
  userApprovalRecord: schema.PolicyRuleAnyApprovalRecord,
): WorkspaceEngine["schemas"]["UserApprovalRecord"] => ({
  userId: userApprovalRecord.userId,
  versionId: userApprovalRecord.deploymentVersionId,
  environmentId: userApprovalRecord.environmentId,
  status: userApprovalRecord.status,
  reason: userApprovalRecord.reason ?? undefined,
  createdAt: userApprovalRecord.createdAt.toISOString(),
});

const getWorkspaceId = async (
  userApprovalRecord: schema.PolicyRuleAnyApprovalRecord,
) =>
  db
    .select()
    .from(schema.environment)
    .innerJoin(schema.system, eq(schema.environment.systemId, schema.system.id))
    .where(eq(schema.environment.id, userApprovalRecord.environmentId))
    .then(takeFirst)
    .then((row) => row.system.workspaceId);

const convertUserApprovalRecordToGoEvent = (
  userApprovalRecord: schema.PolicyRuleAnyApprovalRecord,
  workspaceId: string,
  eventType: keyof GoEventPayload,
): GoMessage<keyof GoEventPayload> => ({
  workspaceId,
  eventType,
  data: getOapiUserApprovalRecord(userApprovalRecord),
  timestamp: Date.now(),
});

export const dispatchUserApprovalRecordCreated = createSpanWrapper(
  "dispatchUserApprovalRecordCreated",
  async (
    span: Span,
    userApprovalRecord: schema.PolicyRuleAnyApprovalRecord,
  ) => {
    const workspaceId = await getWorkspaceId(userApprovalRecord);

    span.setAttribute("userApprovalRecord.id", userApprovalRecord.id);
    span.setAttribute("userApprovalRecord.userId", userApprovalRecord.userId);
    span.setAttribute(
      "userApprovalRecord.environmentId",
      userApprovalRecord.environmentId,
    );
    span.setAttribute(
      "userApprovalRecord.deploymentVersionId",
      userApprovalRecord.deploymentVersionId,
    );
    span.setAttribute("workspace.id", workspaceId);

    const eventType = Event.UserApprovalRecordCreated;
    await sendGoEvent(
      convertUserApprovalRecordToGoEvent(
        userApprovalRecord,
        workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);

export const dispatchUserApprovalRecordUpdated = createSpanWrapper(
  "dispatchUserApprovalRecordUpdated",
  async (
    span: Span,
    userApprovalRecord: schema.PolicyRuleAnyApprovalRecord,
  ) => {
    const workspaceId = await getWorkspaceId(userApprovalRecord);

    span.setAttribute("userApprovalRecord.id", userApprovalRecord.id);
    span.setAttribute("userApprovalRecord.userId", userApprovalRecord.userId);
    span.setAttribute(
      "userApprovalRecord.environmentId",
      userApprovalRecord.environmentId,
    );
    span.setAttribute(
      "userApprovalRecord.deploymentVersionId",
      userApprovalRecord.deploymentVersionId,
    );
    span.setAttribute("workspace.id", workspaceId);

    const eventType = Event.UserApprovalRecordUpdated;
    await sendGoEvent(
      convertUserApprovalRecordToGoEvent(
        userApprovalRecord,
        workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);

export const dispatchUserApprovalRecordDeleted = createSpanWrapper(
  "dispatchUserApprovalRecordDeleted",
  async (
    span: Span,
    userApprovalRecord: schema.PolicyRuleAnyApprovalRecord,
  ) => {
    const workspaceId = await getWorkspaceId(userApprovalRecord);

    span.setAttribute("userApprovalRecord.id", userApprovalRecord.id);
    span.setAttribute("userApprovalRecord.userId", userApprovalRecord.userId);
    span.setAttribute(
      "userApprovalRecord.environmentId",
      userApprovalRecord.environmentId,
    );
    span.setAttribute(
      "userApprovalRecord.deploymentVersionId",
      userApprovalRecord.deploymentVersionId,
    );
    span.setAttribute("workspace.id", workspaceId);

    const eventType = Event.UserApprovalRecordDeleted;
    await sendGoEvent(
      convertUserApprovalRecordToGoEvent(
        userApprovalRecord,
        workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);
