import type * as SCHEMA from "@ctrlplane/db/schema";
import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IconExternalLink, IconLoader2 } from "@tabler/icons-react";
import LZString from "lz-string";
import { z } from "zod";

import { cn } from "@ctrlplane/ui";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import {
  defaultCondition,
  deploymentVersionCondition,
  isComparisonCondition,
  isEmptyCondition,
  isValidDeploymentVersionCondition,
} from "@ctrlplane/validators/releases";

import { DeploymentVersionConditionRender } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionRender";
import { useDeploymentVersionSelector } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/useDeploymentVersionSelector";
import { DeploymentVersionBadgeList } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/DeploymentVersionBadgeList";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

type OverviewProps = {
  deploymentVersionChannel: SCHEMA.DeploymentVersionChannel;
};

const getFinalSelector = (filter: DeploymentVersionCondition | null) =>
  filter && !isEmptyCondition(filter) ? filter : undefined;

const getVersionSelectorUrl = (
  workspaceSlug: string,
  deploymentVersionChannelId: string,
  systemSlug?: string,
  deploymentSlug?: string,
  selector?: DeploymentVersionCondition,
) => {
  if (selector == null || systemSlug == null || deploymentSlug == null)
    return null;
  const baseUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug)
    .baseUrl();
  const selectorHash = LZString.compressToEncodedURIComponent(
    JSON.stringify(selector),
  );
  return `${baseUrl}?selector=${selectorHash}&deployment-version-channel-id=${deploymentVersionChannelId}`;
};

const schema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
  versionSelector: deploymentVersionCondition
    .nullable()
    .refine((r) => r == null || isValidDeploymentVersionCondition(r)),
});

const getVersionSelector = (
  versionSelector: DeploymentVersionCondition | null,
): DeploymentVersionCondition | null => {
  if (versionSelector == null) return null;
  if (!isComparisonCondition(versionSelector))
    return {
      type: ConditionType.Comparison,
      operator: ComparisonOperator.And,
      not: false,
      conditions: [versionSelector],
    };
  return versionSelector;
};

export const Overview: React.FC<OverviewProps> = ({
  deploymentVersionChannel,
}) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
    deploymentSlug?: string;
  }>();
  const { selector: paramSelector, setSelector } =
    useDeploymentVersionSelector();

  const defaultValues = {
    ...deploymentVersionChannel,
    versionSelector: getVersionSelector(
      deploymentVersionChannel.versionSelector,
    ),
    description: deploymentVersionChannel.description ?? undefined,
  };
  const form = useForm({ schema, defaultValues });
  const router = useRouter();
  const utils = api.useUtils();

  const updateDeploymentVersionChannel =
    api.deployment.version.channel.update.useMutation();
  const onSubmit = form.handleSubmit((data) => {
    const versionSelector = getFinalSelector(data.versionSelector);
    updateDeploymentVersionChannel
      .mutateAsync({
        id: deploymentVersionChannel.id,
        data: { ...data, versionSelector },
      })
      .then(() => form.reset({ ...data, versionSelector }))
      .then(() =>
        utils.deployment.version.channel.byId.invalidate(
          deploymentVersionChannel.id,
        ),
      )
      .then(() => paramSelector != null && setSelector(versionSelector ?? null))
      .then(() => router.refresh());
  });

  const { deploymentId } = deploymentVersionChannel;
  const selector = getFinalSelector(form.watch("versionSelector"));

  const versionsQ = api.deployment.version.list.useQuery({
    deploymentId,
    selector,
    limit: 5,
  });
  const versions = versionsQ.data;
  const versionSelectorUrl = getVersionSelectorUrl(
    workspaceSlug,
    deploymentVersionChannel.id,
    systemSlug,
    deploymentSlug,
    selector,
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="versionSelector"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Release Filter
                {versions != null && <span>({versions.total})</span>}
                {versionsQ.isLoading && (
                  <IconLoader2 className="h-3 w-3 animate-spin" />
                )}
              </FormLabel>
              <FormControl>
                <DeploymentVersionConditionRender
                  condition={value ?? defaultCondition}
                  onChange={onChange}
                />
              </FormControl>
              {versions != null && (
                <DeploymentVersionBadgeList versions={versions} />
              )}
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={
              updateDeploymentVersionChannel.isPending ||
              !form.formState.isDirty
            }
          >
            Save
          </Button>
          {versionSelectorUrl != null && (
            <Link
              href={versionSelectorUrl}
              target="_blank"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "flex items-center gap-2",
              )}
            >
              <IconExternalLink className="h-4 w-4" />
              View releases
            </Link>
          )}
        </div>
      </form>
    </Form>
  );
};
