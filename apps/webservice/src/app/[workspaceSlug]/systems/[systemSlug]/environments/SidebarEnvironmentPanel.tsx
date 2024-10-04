"use client";

import type { TargetCondition } from "@ctrlplane/validators/targets";
import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconExternalLink,
  IconInfoCircle,
  IconPlant,
} from "@tabler/icons-react";
import LZString from "lz-string";
import { useReactFlow } from "reactflow";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Separator } from "@ctrlplane/ui/separator";
import { Textarea } from "@ctrlplane/ui/textarea";
import { toast } from "@ctrlplane/ui/toast";

import { TargetConditionBadge } from "~/app/[workspaceSlug]/_components/target-condition/TargetConditionBadge";
import { TargetConditionDialog } from "~/app/[workspaceSlug]/_components/target-condition/TargetConditionDialog";
import { api } from "~/trpc/react";
import { usePanel } from "./SidepanelContext";
import {
  UniqueFilterAcrossTargets,
  useUniqueFilterAcrossTargets,
} from "./UniqueFilterAcrossTargets";

const environmentForm = z.object({
  name: z.string(),
  description: z.string().default(""),
  targetFilter: z.any().optional(),
});

export const SidebarEnvironmentPanel: React.FC = () => {
  const { getNode, getNodes, setNodes } = useReactFlow();
  const { selectedNodeId } = usePanel();
  const node = getNode(selectedNodeId ?? "")!;
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const update = api.environment.update.useMutation();
  const envOverride = api.job.trigger.create.byEnvId.useMutation();

  const form = useForm({
    schema: environmentForm,
    defaultValues: {
      name: node.data.label,
      description: node.data.description,
      targetFilter: node.data.targetFilter,
    },
  });

  /*
   * The form only sets default values on the initial mount, not on subsequent re-renders.
   * Selecting a different environment in the panel doesn't unmount the form.
   * Therefore, useEffect is used to reset the form with the new node data.
   */
  useEffect(() => {
    form.reset({
      name: node.data.label,
      description: node.data.description,
      targetFilter: node.data.targetFilter,
    });
  }, [node, form]);

  const targets = api.target.byWorkspaceId.list.useQuery(
    {
      workspaceId: workspace.data?.id ?? "",
      filter: node.data.targetFilter,
    },
    { enabled: workspace.data != null && node.data.targetFilter != null },
  );

  const utils = api.useUtils();

  const onSubmit = form.handleSubmit((values) => {
    setNodes((nodes) => {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (!node) return nodes;

      update
        .mutateAsync({
          id: node.id,
          data: { ...values },
        })
        .then(() => {
          utils.environment.bySystemId.invalidate(node.data.systemId);
          toast.success(`Environment updated successfully`);
        })
        .catch(() => toast.error(`Failed to update environment`));
      return nodes.map((n) =>
        n.id === selectedNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                ...values,
                label: values.name,
              },
            }
          : n,
      );
    });
  });

  const onFilterDialogSubmit = (condition: TargetCondition | undefined) =>
    setNodes((nodes) => {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (!node) return nodes;

      const updatedNodes = nodes.map((n) =>
        n.id === selectedNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                targetFilter: condition,
              },
            }
          : n,
      );
      form.setValue("targetFilter", condition);
      utils.target.byWorkspaceId.list.invalidate({
        workspaceId: workspace.data?.id ?? "",
      });
      return updatedNodes;
    });

  const nodes = getNodes();
  const uniqueFilterResult = useUniqueFilterAcrossTargets(
    nodes,
    workspace.data?.id ?? "",
  );

  return (
    <Form {...form}>
      <h2 className="flex items-center gap-4 p-6 text-2xl font-semibold">
        <div className="flex-shrink-0 rounded bg-green-500/20 p-1 text-green-400">
          <IconPlant className="h-4 w-4" />
        </div>
        <span className="flex-grow">Environment</span>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 text-neutral-500 hover:text-white"
        >
          <IconInfoCircle className="h-4 w-4" />
        </Button>
      </h2>
      <Separator />
      <form onSubmit={onSubmit} className="m-6 space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Staging, Production, QA..." {...field} />
              </FormControl>
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
                <Textarea placeholder="Add a description..." {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2">
          <Label
            className="flex items-center gap-2"
            onClick={(e) => e.preventDefault()}
          >
            <span>
              Target Filter (
              {node.data.targetFilter != null && targets.data != null
                ? targets.data.total
                : "-"}
              )
            </span>
            {node.data.targetFilter != null && (
              <>
                <UniqueFilterAcrossTargets
                  nodes={nodes}
                  workspaceId={workspace.data?.id ?? ""}
                />
                <Link
                  href={`/${workspaceSlug}/targets?${new URLSearchParams({
                    filter: LZString.compressToEncodedURIComponent(
                      JSON.stringify(node.data.targetFilter),
                    ),
                  })}`}
                  passHref
                >
                  <Button variant="ghost" size="sm" asChild>
                    <a target="_blank" rel="noopener noreferrer">
                      <IconExternalLink className="mr-1 h-4 w-4" />
                      View Targets
                    </a>
                  </Button>
                </Link>
              </>
            )}
          </Label>
          {node.data.targetFilter == null && (
            <span className="text-sm text-muted-foreground">
              Add a filter to select targets for this environment.
            </span>
          )}
          {node.data.targetFilter != null && (
            <TargetConditionBadge condition={node.data.targetFilter} tabbed />
          )}
          <TargetConditionDialog
            condition={node.data.targetFilter}
            onChange={onFilterDialogSubmit}
          >
            <Button variant="outline" className="w-fit">
              Set targets
            </Button>
          </TargetConditionDialog>
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={update.isPending || uniqueFilterResult?.isUnique == false}
          >
            Save
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              selectedNodeId != null && envOverride.mutate(selectedNodeId)
            }
          >
            Override
          </Button>
        </div>
      </form>
    </Form>
  );
};
