"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type { JobAgent, Workspace } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { createRunbookVariable } from "@ctrlplane/db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { useForm } from "@ctrlplane/ui/form";

import type { EditRunbookFormSchema } from "./EditRunbookForm";
import { api } from "~/trpc/react";
import { EditRunbookForm } from "./EditRunbookForm";

const updateRunbookSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  variables: z.array(createRunbookVariable),
  jobAgentId: z.string().uuid({ message: "Must be a valid job agent ID" }),
  jobAgentConfig: z.record(z.any()),
});

export const EditRunbookDialog: React.FC<{
  workspace: Workspace;
  jobAgents: JobAgent[];
  runbook: RouterOutputs["runbook"]["bySystemId"][number];
  children: React.ReactNode;
}> = ({ workspace, jobAgents, runbook, children }) => {
  const [open, setOpen] = useState(false);
  const update = api.runbook.update.useMutation();
  const form = useForm({
    schema: updateRunbookSchema,
    disabled: update.isPending,
    defaultValues: {
      ...runbook,
      description: runbook.description ?? "",
      jobAgentId: runbook.jobAgentId ?? "",
    },
  });

  const router = useRouter();

  const onSubmit = (data: EditRunbookFormSchema) =>
    update
      .mutateAsync({ id: runbook.id, data })
      .then(() => router.refresh())
      .then(() => setOpen(false));

  const jobAgentId = form.watch("jobAgentId");
  const jobAgent = jobAgents.find((j) => j.id === jobAgentId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700 max-h-[95vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Runbook</DialogTitle>
        </DialogHeader>
        <EditRunbookForm
          form={form}
          jobAgents={jobAgents}
          jobAgent={jobAgent}
          workspace={workspace}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
};
