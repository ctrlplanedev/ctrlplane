"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { useForm } from "@ctrlplane/ui/form";

import type { EditRunbookFormSchema } from "../../EditRunbookForm";
import { api } from "~/trpc/react";
import { EditRunbookForm, updateRunbookSchema } from "../../EditRunbookForm";

type EditRunbookProps = {
  runbook: NonNullable<RouterOutputs["runbook"]["byId"]>;
  jobAgents: SCHEMA.JobAgent[];
  jobAgent: SCHEMA.JobAgent;
  workspace: SCHEMA.Workspace;
};

export const EditRunbook: React.FC<EditRunbookProps> = ({
  runbook,
  jobAgents,
  jobAgent,
  workspace,
}) => {
  const defaultValues = {
    ...runbook,
    description: runbook.description ?? "",
    jobAgentId: jobAgent.id,
    jobAgentConfig: jobAgent.config,
  };

  const form = useForm({ schema: updateRunbookSchema, defaultValues });
  const update = api.runbook.update.useMutation();
  const router = useRouter();

  const onSubmit = (data: EditRunbookFormSchema) =>
    update.mutateAsync({ id: runbook.id, data }).then(() => router.refresh());

  return (
    <EditRunbookForm
      form={form}
      jobAgents={jobAgents}
      jobAgent={jobAgent}
      workspace={workspace}
      onSubmit={onSubmit}
    />
  );
};
