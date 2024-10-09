"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { SiKubernetes, SiTerraform } from "@icons-pack/react-simple-icons";
import {
  IconExternalLink,
  IconPlant,
  IconServer,
  IconTarget,
} from "@tabler/icons-react";
import * as LZString from "lz-string";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
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
import { Label } from "@ctrlplane/ui/label";
import { Separator } from "@ctrlplane/ui/separator";
import { Textarea } from "@ctrlplane/ui/textarea";
import {
  defaultCondition,
  targetCondition,
} from "@ctrlplane/validators/targets";

import { api } from "~/trpc/react";
import { TargetConditionRender } from "./target-condition/TargetConditionRender";

const DeleteEnvironmentDialog: React.FC<{
  environment: schema.Environment;
  children: React.ReactNode;
}> = ({ environment, children }) => {
  const deleteEnvironment = api.environment.delete.useMutation();
  const utils = api.useUtils();
  const { removeEnvironmentId } = useEnvironmentDrawer();

  const onDelete = () =>
    deleteEnvironment
      .mutateAsync(environment.id)
      .then(() => utils.environment.bySystemId.invalidate(environment.systemId))
      .then(removeEnvironmentId);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Environment</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to delete this environment? You will have to
          recreate it from scratch.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
const environmentForm = z.object({
  name: z.string(),
  description: z.string().default(""),
});

const EnvironmentForm: React.FC<{
  environment: schema.Environment;
}> = ({ environment }) => {
  const form = useForm({
    schema: environmentForm,
    defaultValues: {
      name: environment.name,
      description: environment.description ?? "",
    },
  });
  const update = api.environment.update.useMutation();
  const envOverride = api.job.trigger.create.byEnvId.useMutation();

  const utils = api.useUtils();

  const { id, systemId } = environment;
  const onSubmit = form.handleSubmit((data) =>
    update
      .mutateAsync({ id, data })
      .then(() => form.reset(data))
      .then(() => utils.environment.bySystemId.invalidate(systemId))
      .then(() => utils.environment.byId.invalidate(id)),
  );

  return (
    <Form {...form}>
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

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={update.isPending || !form.formState.isDirty}
          >
            Save
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              envOverride
                .mutateAsync(id)
                .then(() => utils.environment.bySystemId.invalidate(systemId))
                .then(() => utils.environment.byId.invalidate(id))
            }
          >
            Override
          </Button>
          <div className="flex-grow" />
          <DeleteEnvironmentDialog environment={environment}>
            <Button variant="destructive">Delete</Button>
          </DeleteEnvironmentDialog>
        </div>
      </form>
    </Form>
  );
};

const TargetIcon: React.FC<{ version: string }> = ({ version }) => {
  if (version.includes("kubernetes"))
    return <SiKubernetes className="h-6 w-6 shrink-0 text-blue-300" />;
  if (version.includes("vm") || version.includes("compute"))
    return <IconServer className="h-6 w-6 shrink-0 text-cyan-300" />;
  if (version.includes("terraform"))
    return <SiTerraform className="h-6 w-6 shrink-0 text-purple-300" />;
  return <IconTarget className="h-6 w-6 shrink-0 text-neutral-300" />;
};

const filterForm = z.object({
  targetFilter: targetCondition.optional(),
});

const EditFilterForm: React.FC<{
  environment: schema.Environment;
}> = ({ environment }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;

  const update = api.environment.update.useMutation();
  const form = useForm({
    schema: filterForm,
    defaultValues: { targetFilter: environment.targetFilter ?? undefined },
  });

  const { targetFilter } = form.watch();

  const targets = api.target.byWorkspaceId.list.useQuery(
    {
      workspaceId: workspace?.id ?? "",
      filter: targetFilter ?? undefined,
      limit: 10,
    },
    { enabled: workspace != null },
  );

  const utils = api.useUtils();

  const onSubmit = form.handleSubmit((data) =>
    update
      .mutateAsync({
        id: environment.id,
        data: {
          ...data,
          targetFilter: targetFilter ?? null,
        },
      })
      .then(() => form.reset(data))
      .then(() => utils.environment.bySystemId.invalidate(environment.systemId))
      .then(() => utils.environment.byId.invalidate(environment.id)),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="m-6 space-y-8">
        <div className="space-y-2">
          <FormField
            control={form.control}
            name="targetFilter"
            render={({ field: { onChange } }) => (
              <FormItem>
                <FormLabel>Target Filter</FormLabel>
                <FormControl>
                  <TargetConditionRender
                    condition={targetFilter ?? defaultCondition}
                    onChange={onChange}
                  />
                </FormControl>
                <FormMessage />
                {form.formState.isDirty && (
                  <span className="text-xs text-muted-foreground">
                    Save to apply
                  </span>
                )}
              </FormItem>
            )}
          />

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={update.isPending || !form.formState.isDirty}
            >
              Save
            </Button>
            {targetFilter != null && (
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  form.setValue("targetFilter", undefined, {
                    shouldValidate: true,
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {targetFilter != null &&
          targets.data != null &&
          targets.data.total > 0 && (
            <div className="space-y-4">
              <Label>Targets ({targets.data.total})</Label>
              <div className="space-y-2">
                {targets.data.items.map((target) => (
                  <div className="flex items-center gap-2" key={target.id}>
                    <TargetIcon version={target.version} />
                    <div className="flex flex-col">
                      <span className="overflow-hidden text-nowrap text-sm">
                        {target.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {target.version}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm">
                <Link
                  href={`/${workspaceSlug}/targets?${new URLSearchParams({
                    filter: LZString.compressToEncodedURIComponent(
                      JSON.stringify(form.getValues("targetFilter")),
                    ),
                  })}`}
                  className="flex items-center gap-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconExternalLink className="h-4 w-4" />
                  View Targets
                </Link>
              </Button>
            </div>
          )}
      </form>
    </Form>
  );
};

const param = "environment_id";
export const useEnvironmentDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const environmentId = params.get(param);

  const setEnvironmentId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, id);
    }
    router.replace(url.toString());
  };

  const removeEnvironmentId = () => setEnvironmentId(null);

  return { environmentId, setEnvironmentId, removeEnvironmentId };
};

export const EnvironmentDrawer: React.FC = () => {
  const { environmentId, removeEnvironmentId } = useEnvironmentDrawer();
  const isOpen = environmentId != null && environmentId != "";
  const setIsOpen = removeEnvironmentId;
  const environmentQ = api.environment.byId.useQuery(environmentId ?? "", {
    enabled: isOpen,
  });
  const environment = environmentQ.data;

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-[1100px] overflow-auto rounded-none focus-visible:outline-none"
      >
        <DrawerTitle className="flex items-center gap-2 border-b p-6">
          <div className="flex-shrink-0 rounded bg-green-500/20 p-1 text-green-400">
            <IconPlant className="h-4 w-4" />
          </div>
          {environment?.name}
        </DrawerTitle>

        <div className="flex w-full gap-6">
          {environment != null && workspace != null && (
            <div className="w-full space-y-12 overflow-auto">
              <EnvironmentForm environment={environment} />
              <Separator />
              <EditFilterForm environment={environment} />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
