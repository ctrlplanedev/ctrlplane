"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { TbFilter, TbLayout, TbPlant, TbResize, TbTrash } from "react-icons/tb";
import { MarkerType, useReactFlow, useViewport } from "reactflow";
import colors from "tailwindcss/colors";
import { z } from "zod";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
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
import { DeleteNodeDialog, useDeleteNodeDialog } from "./DeleteNodeDialog";
import { useHandleEdgeDelete } from "./edges";
import { NodeType } from "./FlowNodeTypes";
import { usePanel } from "./SidepanelContext";

const environmentForm = z.object({
  name: z.string(),
  description: z.string().default(""),
  targetFilter: z.array(z.object({ key: z.string(), value: z.string() })),
});

type EnvironmentFormValues = z.infer<typeof environmentForm>;

const AddEnvironmentButton: React.FC<{ systemId: string }> = ({ systemId }) => {
  const create = api.environment.create.useMutation();

  const { setSelectedNodeId } = usePanel();
  const [open, setOpen] = useState(false);
  const form = useForm<EnvironmentFormValues>({
    resolver: zodResolver(environmentForm),
    defaultValues: {
      name: "",
      description: "",
      targetFilter: [],
    },
  });

  const { targetFilter } = form.watch();
  const targets = api.environment.target.byFilter.useQuery(
    Object.fromEntries(targetFilter.map(({ key, value }) => [key, value])),
  );

  const { fields } = useFieldArray({
    name: "targetFilter",
    control: form.control,
  });

  const { addNodes, addEdges } = useReactFlow();
  const { x, y } = useViewport();
  const onSubmit = form.handleSubmit(async (values) => {
    const targetFilter = Object.fromEntries(
      values.targetFilter.map(({ key, value }) => [key, value]),
    );
    setOpen(false);
    const env = await create.mutateAsync({ ...values, systemId, targetFilter });
    addNodes({
      id: env.id,
      type: NodeType.Environment,
      position: { x, y },
      data: { ...env, label: env.name },
    });
    addEdges({
      id: "trigger-" + env.id,
      source: "trigger",
      target: env.id,
      markerEnd: {
        type: MarkerType.Arrow,
        color: colors.neutral[700],
      },
    });

    window.requestAnimationFrame(() => setSelectedNodeId(env.id));
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="gap-2 border border-green-500 bg-transparent text-green-400"
          variant="outline"
          disabled={create.isPending}
        >
          <TbPlant /> Add Environment
        </Button>
      </DialogTrigger>

      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Add Environments</DialogTitle>
              <DialogDescription>
                Group your deployments by environment. Environments can be used
                to group targets.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Staging, Production, QA..."
                      {...field}
                    />
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
                        Target Filter ({targets.data?.length ?? "-"})
                      </FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Key"
                            value={value.key}
                            onChange={(e) =>
                              onChange({ ...value, key: e.target.value })
                            }
                          />
                          <Input
                            placeholder="Value"
                            value={value.value}
                            onChange={(e) =>
                              onChange({ ...value, value: e.target.value })
                            }
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const NewPolicyButton: React.FC<{ systemId: string }> = ({ systemId }) => {
  const create = api.environment.policy.create.useMutation();
  const { addNodes, addEdges } = useReactFlow();
  const { x, y } = useViewport();
  const { setSelectedNodeId } = usePanel();
  return (
    <Button
      className="gap-2 border border-purple-500 bg-transparent text-purple-400"
      variant="outline"
      disabled={create.isPending}
      onClick={async (e) => {
        e.preventDefault();
        const policy = await create.mutateAsync({ name: "", systemId });
        addNodes({
          id: policy.id,
          type: NodeType.Policy,
          position: { x, y },
          data: { ...policy, label: policy.name },
        });
        addEdges({
          id: "trigger-" + policy.id,
          source: "trigger",
          target: policy.id,
          markerEnd: {
            type: MarkerType.Arrow,
            color: colors.neutral[700],
          },
        });
        window.requestAnimationFrame(() => setSelectedNodeId(policy.id));
      }}
    >
      <TbFilter /> New Policy
    </Button>
  );
};

const useDeleteNodeOrEdge = () => {
  const { selectedNodeId, selectedEdgeId } = usePanel();
  const { getEdges } = useReactFlow();
  const handleEdgeDelete = useHandleEdgeDelete();
  const { setOpen } = useDeleteNodeDialog();

  if (selectedEdgeId != null)
    return {
      disabled: false,
      onDelete: () => {
        handleEdgeDelete(getEdges().find((e) => e.id === selectedEdgeId)!);
      },
    };

  if (selectedNodeId != null)
    return {
      disabled: false,
      onDelete: () => setOpen(true),
    };

  return {
    disabled: true,
    onDelete: () => {},
  };
};

export const EnvFlowPanel: React.FC<{
  systemId: string;
  onLayout: () => void;
}> = ({ onLayout, systemId }) => {
  const { fitView } = useReactFlow();
  const { disabled, onDelete } = useDeleteNodeOrEdge();
  return (
    <div className="flex items-center space-x-1 rounded-lg border bg-neutral-900 p-2 shadow-2xl drop-shadow-2xl">
      <Button
        variant="outline"
        size="icon"
        className="bg-transparent"
        onClick={() => fitView({ padding: 0.12 })}
      >
        <TbResize />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="bg-transparent"
        onClick={onLayout}
      >
        <TbLayout />
      </Button>

      <div className="px-2">
        <Separator orientation="vertical" className="h-10" />
      </div>

      <AddEnvironmentButton systemId={systemId} />
      <NewPolicyButton systemId={systemId} />

      <div className="px-2">
        <Separator orientation="vertical" className="h-10" />
      </div>

      <Button
        className="border border-red-500 bg-transparent text-red-500 hover:border-red-400 hover:bg-red-400/20 hover:text-red-400"
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={onDelete}
      >
        <TbTrash />
      </Button>
      <DeleteNodeDialog />
    </div>
  );
};
