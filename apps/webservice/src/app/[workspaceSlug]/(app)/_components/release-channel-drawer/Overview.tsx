import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ReleaseCondition } from "@ctrlplane/validators/releases";
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
  FilterType,
} from "@ctrlplane/validators/conditions";
import {
  defaultCondition,
  isComparisonCondition,
  isEmptyCondition,
  isValidReleaseCondition,
  releaseCondition,
} from "@ctrlplane/validators/releases";

import { api } from "~/trpc/react";
import { ReleaseConditionRender } from "../release-condition/ReleaseConditionRender";
import { useReleaseFilter } from "../release-condition/useReleaseFilter";
import { ReleaseBadgeList } from "../ReleaseBadgeList";

type OverviewProps = {
  releaseChannel: SCHEMA.DeploymentVersionChannel;
};

const getFinalFilter = (filter: ReleaseCondition | null) =>
  filter && !isEmptyCondition(filter) ? filter : undefined;

const getReleaseFilterUrl = (
  workspaceSlug: string,
  releaseChannelId: string,
  systemSlug?: string,
  deploymentSlug?: string,
  filter?: ReleaseCondition,
) => {
  if (filter == null || systemSlug == null || deploymentSlug == null)
    return null;
  const baseUrl = `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}`;
  const filterHash = LZString.compressToEncodedURIComponent(
    JSON.stringify(filter),
  );
  return `${baseUrl}/releases?filter=${filterHash}&release-channel-id=${releaseChannelId}`;
};

const schema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
  releaseFilter: releaseCondition
    .nullable()
    .refine((r) => r == null || isValidReleaseCondition(r)),
});

const getFilter = (
  releaseFilter: ReleaseCondition | null,
): ReleaseCondition | null => {
  if (releaseFilter == null) return null;
  if (!isComparisonCondition(releaseFilter))
    return {
      type: FilterType.Comparison,
      operator: ComparisonOperator.And,
      not: false,
      conditions: [releaseFilter],
    };
  return releaseFilter;
};

export const Overview: React.FC<OverviewProps> = ({ releaseChannel }) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
    deploymentSlug?: string;
  }>();
  const { filter: paramFilter, setFilter } = useReleaseFilter();

  const defaultValues = {
    ...releaseChannel,
    releaseFilter: getFilter(releaseChannel.releaseFilter),
    description: releaseChannel.description ?? undefined,
  };
  const form = useForm({ schema, defaultValues });
  const router = useRouter();
  const utils = api.useUtils();

  const updateReleaseChannel =
    api.deployment.releaseChannel.update.useMutation();
  const onSubmit = form.handleSubmit((data) => {
    const releaseFilter = getFinalFilter(data.releaseFilter);
    updateReleaseChannel
      .mutateAsync({ id: releaseChannel.id, data: { ...data, releaseFilter } })
      .then(() => form.reset({ ...data, releaseFilter }))
      .then(() =>
        utils.deployment.releaseChannel.byId.invalidate(releaseChannel.id),
      )
      .then(() => paramFilter != null && setFilter(releaseFilter ?? null))
      .then(() => router.refresh());
  });

  const { deploymentId } = releaseChannel;
  const filter = getFinalFilter(form.watch("releaseFilter"));

  const releasesQ = api.deployment.version.list.useQuery({
    deploymentId,
    filter,
    limit: 5,
  });
  const releases = releasesQ.data;
  const releaseFilterUrl = getReleaseFilterUrl(
    workspaceSlug,
    releaseChannel.id,
    systemSlug,
    deploymentSlug,
    filter,
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
          name="releaseFilter"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Release Filter
                {releases != null && <span>({releases.total})</span>}
                {releasesQ.isLoading && (
                  <IconLoader2 className="h-3 w-3 animate-spin" />
                )}
              </FormLabel>
              <FormControl>
                <ReleaseConditionRender
                  condition={value ?? defaultCondition}
                  onChange={onChange}
                />
              </FormControl>
              {releases != null && <ReleaseBadgeList releases={releases} />}
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={updateReleaseChannel.isPending || !form.formState.isDirty}
          >
            Save
          </Button>
          {releaseFilterUrl != null && (
            <Link
              href={releaseFilterUrl}
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
