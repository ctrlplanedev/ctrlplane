"use client";

import Link from "next/link";
import { IconSparkles } from "@tabler/icons-react";
import { isPresent } from "ts-is-present";

import { Button } from "@ctrlplane/ui/button";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { usePolicyContext } from "./PolicyContext";

export const PolicySubmit: React.FC<{
  workspaceSlug: string;
}> = ({ workspaceSlug }) => {
  const { form } = usePolicyContext();

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

  const errors = form.formState.errors;
  const rootError = errors.root?.message;
  const allErrors = Object.values(
    errors as Record<string, { message?: string }>,
  )
    .map((error) => error.message ?? null)
    .filter(isPresent);

  return (
    <div className="ml-64 flex items-center gap-2">
      <Link href={urls.workspace(workspaceSlug).policies().baseUrl()}>
        <Button variant="outline" type="button">
          Cancel
        </Button>
      </Link>
      <Button disabled={form.formState.isSubmitting} type="submit">
        {form.formState.isSubmitting ? "Creating..." : "Create Policy"}
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

      <span className="text-xs text-red-500">
        {rootError ?? allErrors.join(", ")}
      </span>
    </div>
  );
};
