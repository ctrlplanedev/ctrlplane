"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconExternalLink, IconFilter } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ctrlplane/ui/form";
import { defaultCondition } from "@ctrlplane/validators/releases";

import { DeploymentVersionConditionBadge } from "../../../_components/deployments/version/condition/DeploymentVersionConditionBadge";
import { DeploymentVersionConditionDialog } from "../../../_components/deployments/version/condition/DeploymentVersionConditionDialog";

// Version selector schema
const versionSelectorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),

  versionSelector: z.any(),
});

type VersionSelectorFormValues = z.infer<typeof versionSelectorSchema>;

const defaultValues: Partial<VersionSelectorFormValues> = {
  versionSelector: {},
};

export const DeploymentFlow: React.FC = () => {
  const form = useForm<VersionSelectorFormValues>({
    resolver: zodResolver(versionSelectorSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit((data) => {
    console.log(data);
  });

  const deploymentId = "";
  const versionSelectorUrl = "";
  //   const versionsQ = api.deployment.version.list.useQuery(
  //   { deploymentId, filter: selector, limit: 5 },
  //   { enabled: selector != null, placeholderData: (prev) => prev },
  // );
  // const versions = versionsQ.data;
  const versions: undefined | { total: number | undefined } = {
    total: undefined,
  };

  return (
    <div className="max-w-xl space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Deployment Flow Rules</h2>
        <p className="text-sm text-muted-foreground">
          Configure how deployments progress through your environments
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-md font-medium">Version Selection Rules</h3>
          <p className="text-sm text-muted-foreground">
            Control which versions can be deployed to environments
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <FormField
              control={form.control}
              name="versionSelector"
              render={({ field: { value, onChange } }) => (
                <FormItem className="space-y-2">
                  <FormLabel>
                    Version Selector ({versions.total ?? "-"})
                  </FormLabel>
                  {value != null && (
                    <DeploymentVersionConditionBadge condition={value} />
                  )}
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <DeploymentVersionConditionDialog
                        condition={value ?? defaultCondition}
                        deploymentId={deploymentId}
                        onChange={onChange}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <IconFilter className="h-4 w-4" />
                          Edit selector
                        </Button>
                      </DeploymentVersionConditionDialog>

                      <Link href={versionSelectorUrl} target="_blank">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className="flex items-center gap-2"
                        >
                          <IconExternalLink className="h-4 w-4" />
                          View versions
                        </Button>
                      </Link>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </div>
  );
};
