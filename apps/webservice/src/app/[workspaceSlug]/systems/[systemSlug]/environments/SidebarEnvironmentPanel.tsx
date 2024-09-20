"use client";

import type { EqualCondition } from "@ctrlplane/validators/targets";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { TbInfoCircle, TbPlant } from "react-icons/tb";
import { useReactFlow } from "reactflow";
import { z } from "zod";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Separator } from "@ctrlplane/ui/separator";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";
import { MetadataFilterInput } from "../../../_components/MetadataFilterInput";
import { usePanel } from "./SidepanelContext";

const environmentForm = z.object({
  name: z.string(),
  description: z.string().default(""),
  targetFilter: z.array(z.object({ key: z.string(), value: z.string() })),
});

type EnvironmentFormValues = z.infer<typeof environmentForm>;

export const SidebarEnvironmentPanel: React.FC = () => {
  const { getNode, setNodes } = useReactFlow();
  const { selectedNodeId } = usePanel();
  const node = getNode(selectedNodeId ?? "")!;
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const update = api.environment.update.useMutation();
  const envOverride = api.job.trigger.create.byEnvId.useMutation();

  const form = useForm<EnvironmentFormValues>({
    resolver: zodResolver(environmentForm),
    defaultValues: {
      name: node.data.label,
      description: node.data.description,
      targetFilter: (
        (node.data.targetFilter?.conditions ?? []) as EqualCondition[]
      ).map((item) => ({ key: item.key, value: item.value })),
    },
    mode: "onChange",
  });

  useEffect(() => {
    form.setValue("name", node.data.label);
    form.setValue("description", node.data.description);
    form.setValue(
      "targetFilter",
      ((node.data.targetFilter?.conditions ?? []) as EqualCondition[]).map(
        (item) => ({ key: item.key, value: item.value }),
      ),
    );
  }, [node.data.label, node.data.description, node.data.targetFilter, form]);

  const { targetFilter } = form.watch();

  const targets = api.target.byWorkspaceId.list.useQuery(
    {
      workspaceId: workspace.data?.id ?? "",
      filters: [
        {
          key: "metadata",
          value: Object.fromEntries(
            targetFilter.map(({ key, value }) => [key, value]),
          ),
        },
      ],
    },
    { enabled: workspace.data != null },
  );
  const { fields, append, remove } = useFieldArray({
    name: "targetFilter",
    control: form.control,
  });

  const onSubmit = form.handleSubmit((values) => {
    setNodes((nodes) => {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (!node) return nodes;
      update.mutate({
        id: node.id,
        data: {
          ...values,
          targetFilter: {
            operator: "and",
            conditions: values.targetFilter.map(({ key, value }) => ({
              key,
              value,
            })),
          },
        },
      });
      return nodes.map((n) =>
        n.id === selectedNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                ...values,
                targetFilter,
                label: values.name,
              },
            }
          : n,
      );
    });
  });

  return (
    <Form {...form}>
      <h2 className="flex items-center gap-4 p-6 text-2xl font-semibold">
        <div className="flex-shrink-0 rounded bg-green-500/20 p-1 text-green-400">
          <TbPlant />
        </div>
        <span className="flex-grow">Environment</span>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 text-neutral-500 hover:text-white"
        >
          <TbInfoCircle />
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
        <div>
          {fields.map((field, index) => (
            <FormField
              control={form.control}
              key={field.id}
              name={`targetFilter.${index}`}
              render={({ field: { onChange, value } }) => (
                <FormItem>
                  <FormLabel className={cn(index !== 0 && "sr-only")}>
                    Target Filter ({targets.data?.total ?? "-"})
                  </FormLabel>
                  <FormControl>
                    <MetadataFilterInput
                      value={value}
                      onChange={onChange}
                      onRemove={() => remove(index)}
                      workspaceId={workspace.data?.id}
                      numInputs={fields.length}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            //   disabled={isLastEmpty}
            onClick={() => append({ key: "", value: "" })}
          >
            Add Label
          </Button>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={update.isPending}>
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
