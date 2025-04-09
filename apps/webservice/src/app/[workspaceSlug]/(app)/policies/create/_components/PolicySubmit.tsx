"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconSparkles } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { usePolicyContext } from "./PolicyContext";

export const PolicySubmit: React.FC<{
  workspaceId: string;
  workspaceSlug: string;
}> = ({ workspaceId, workspaceSlug }) => {
  const { form } = usePolicyContext();
  const router = useRouter();

  const utils = api.useUtils();
  const createPolicy = api.policy.create.useMutation({
    onSuccess: () => {
      toast.success("Policy created successfully");
      router.push(urls.workspace(workspaceSlug).policies().baseUrl());
      utils.policy.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to create policy", {
        description: error.message,
      });
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    console.log(data);
    createPolicy.mutate({ ...data, workspaceId });
  });

  const generateName = api.policy.ai.generateName.useMutation({
    onSuccess: (data) => {
      form.setValue("name", data);
    },
  });

  const generateDescription = api.policy.ai.generateDescription.useMutation({
    onSuccess: (data) => {
      form.setValue("description", data);
    },
  });

  return (
    <div className="ml-64 flex items-center gap-2">
      <Link href={urls.workspace(workspaceSlug).policies().baseUrl()}>
        <Button variant="outline" type="button">
          Cancel
        </Button>
      </Link>
      <Button onClick={onSubmit} disabled={createPolicy.isPending}>
        {createPolicy.isPending ? "Creating..." : "Create Policy"}
      </Button>

      <Button
        onClick={() => {
          generateName.mutate(form.getValues());
        }}
        disabled={generateName.isPending}
        variant="ghost"
        className="gap-2"
      >
        <IconSparkles className="h-4 w-4" />
        {generateName.isPending ? "Generating..." : "Generate Name"}
      </Button>

      <Button
        onClick={() => {
          generateDescription.mutate(form.getValues());
        }}
        disabled={generateDescription.isPending}
        variant="ghost"
        className="gap-2"
      >
        <IconSparkles className="h-4 w-4" />
        {generateDescription.isPending
          ? "Generating..."
          : "Generate Description"}
      </Button>
    </div>
  );
};
