import type { Tx } from "@ctrlplane/db";

import { buildConflictUpdateColumns, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { HookAction } from "@ctrlplane/validators/events";

type ExitHookInsert = {
  name: string;
  jobAgentId: string;
  jobAgentConfig: Record<string, any>;
};

const upsertHook = (db: Tx, hookName: string, deploymentId: string) =>
  db
    .insert(schema.hook)
    .values({
      name: hookName,
      action: HookAction.DeploymentResourceRemoved,
      scopeType: "deployment",
      scopeId: deploymentId,
    })
    .onConflictDoUpdate({
      target: [schema.hook.name, schema.hook.scopeType, schema.hook.scopeId],
      set: buildConflictUpdateColumns(schema.hook, ["action"]),
    })
    .returning()
    .then(takeFirst);

const upsertRunbook = (
  db: Tx,
  exitHook: ExitHookInsert,
  deploymentId: string,
) =>
  db
    .insert(schema.runbook)
    .values({ ...exitHook, systemId: deploymentId })
    .onConflictDoUpdate({
      target: [schema.runbook.name, schema.runbook.systemId],
      set: buildConflictUpdateColumns(schema.runbook, [
        "jobAgentId",
        "jobAgentConfig",
      ]),
    })
    .returning()
    .then(takeFirst);

const upsertRunbookVariables = (db: Tx, runbookId: string) => {
  const variableConfig = {
    type: "string" as const,
    inputType: "text" as const,
    required: true,
  };
  const variables = [
    {
      key: "resourceId",
      name: "Resource ID",
      description: "The ID of the resource to be removed",
      config: variableConfig,
      required: true,
      runbookId,
    },
    {
      key: "deploymentId",
      name: "Deployment ID",
      description: "The ID of the deployment",
      config: variableConfig,
      required: true,
      runbookId,
    },
  ];

  return db
    .insert(schema.runbookVariable)
    .values(variables)
    .onConflictDoNothing();
};

const upsertRunhook = (db: Tx, hookId: string, runbookId: string) =>
  db.insert(schema.runhook).values({ hookId, runbookId }).onConflictDoNothing();

export const upsertExitHook = async (
  tx: Tx,
  deployment: schema.Deployment,
  exitHook: ExitHookInsert,
) => {
  const hook = await upsertHook(tx, exitHook.name, deployment.id);
  const runbook = await upsertRunbook(tx, exitHook, deployment.systemId);
  await upsertRunbookVariables(tx, runbook.id);
  await upsertRunhook(tx, hook.id, runbook.id);
};
