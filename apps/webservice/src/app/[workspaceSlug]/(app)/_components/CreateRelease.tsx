"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  IconFilterExclamation,
  IconFilterFilled,
  IconX,
} from "@tabler/icons-react";
import { z } from "zod";

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
  FormRootError,
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Switch } from "@ctrlplane/ui/switch";
import { toast } from "@ctrlplane/ui/toast";
import {
  defaultCondition,
  isEmptyCondition,
  releaseCondition,
  ReleaseStatus,
} from "@ctrlplane/validators/releases";

import { api } from "~/trpc/react";
import { ReleaseConditionDialog } from "./release-condition/ReleaseConditionDialog";

const releaseDependency = z.object({
  deploymentId: z.string().uuid(),
  releaseFilter: releaseCondition.nullable(),
});

const releaseForm = z.object({
  systemId: z.string().uuid(),
  deploymentId: z.string().uuid(),
  version: z.string().min(1).max(255),
  status: z.nativeEnum(ReleaseStatus),
  releaseDependencies: z.array(releaseDependency).refine((deps) => {
    const deploymentIds = deps.map((d) => d.deploymentId);
    return new Set(deploymentIds).size === deploymentIds.length;
  }, "Cannot reuse a deployment in multiple release dependencies"),
});

export const CreateReleaseDialog: React.FC<{
  deploymentId?: string;
  systemId?: string;
  children?: React.ReactNode;
  version?: string;
  onClose?: () => void;
}> = ({ children, ...props }) => {
  const create = api.deployment.version.create.useMutation();
  const form = useForm({
    schema: releaseForm,
    defaultValues: {
      deploymentId: props.deploymentId ?? "",
      systemId: props.systemId ?? "",
      version: props.version ?? "",
      releaseDependencies: [],
      status: ReleaseStatus.Ready,
    },
  });

  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false);

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const { systemId, deploymentId } = form.watch();
  const systems = api.system.list.useQuery(
    { workspaceId: workspace.data?.id ?? "" },
    { enabled: workspace.data != null && workspace.data.id !== "" },
  );
  const deployments = api.deployment.bySystemId.useQuery(systemId, {
    enabled: systemId !== "",
  });
  const globalDeployments = api.deployment.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.data != null && workspace.data.id !== "" },
  );

  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      if (props.systemId != null) {
        form.setFocus("deploymentId");
        return;
      }
    });
  }, [form, props, open]);

  const router = useRouter();
  const utils = api.useUtils();
  const onSubmit = form.handleSubmit(async (data) => {
    const releaseDependencies = data.releaseDependencies.map((dep) => ({
      ...dep,
      releaseFilter:
        dep.releaseFilter == null || isEmptyCondition(dep.releaseFilter)
          ? null
          : dep.releaseFilter,
    }));
    const release = await create.mutateAsync({
      ...data,
      releaseDependencies,
      name: data.version.trim(),
    });
    await utils.deployment.version.list.invalidate({
      deploymentId: release.deploymentId,
    });

    const deployment = deployments.data?.find(
      (d) => d.id === data.deploymentId,
    );
    const system = systems.data?.items.find((s) => s.id === data.systemId);
    router.push(
      `/${workspaceSlug}/systems/${system?.slug}/deployments/${deployment?.slug}/releases/${release.id}`,
    );
    setOpen(false);

    const numOfReleaseJobTriggers = release.releaseJobTriggers.length;
    toast(
      numOfReleaseJobTriggers === 0
        ? `No resources to deploy release too.`
        : `Dispatching ${release.releaseJobTriggers.length} job configuration${release.releaseJobTriggers.length > 1 ? "s" : ""}.`,
      { dismissible: true, duration: 2_000 },
    );

    props.onClose?.();
    setOpen(false);
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "releaseDependencies",
  });

  const formErrors = form.formState.errors.releaseDependencies ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>New Release</DialogTitle>
              <DialogDescription>
                A release is a fixed snapshot of a deployment, therefore, all
                necessary assets must be fully prepared before creating a new
                release.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="systemId"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>System</FormLabel>
                  <FormControl>
                    <Select value={value} onValueChange={onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {systems.data?.items.map((system) => (
                            <SelectItem key={system.id} value={system.id}>
                              {system.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deploymentId"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>Deployment</FormLabel>
                  <FormControl>
                    <Select value={value} onValueChange={onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {deployments.data?.map((deployment) => (
                            <SelectItem
                              key={deployment.id}
                              value={deployment.id}
                            >
                              {deployment.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="version"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Version</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="v1.0.0, 20250101.1, ..."
                      {...field}
                      autoFocus
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex items-center gap-2">
              <Switch
                checked={advancedOptionsOpen}
                onCheckedChange={setAdvancedOptionsOpen}
                id="advanced-options"
              />
              <Label htmlFor="advanced-options">Advanced options</Label>
            </div>

            {advancedOptionsOpen && (
              <>
                <div className="flex flex-col space-y-3">
                  <Label>Release Dependencies</Label>
                  <span className="text-sm text-muted-foreground">
                    Dependencies must be fulfilled for a resource before this
                    Release can be applied to that resource. Read more about
                    release dependencies here.
                  </span>

                  {fields.map((_, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <FormField
                        control={form.control}
                        name={`releaseDependencies.${index}.deploymentId`}
                        render={({ field: { value, onChange } }) => (
                          <FormItem>
                            <FormControl>
                              <Select value={value} onValueChange={onChange}>
                                <SelectTrigger className="w-32 text-sm">
                                  <SelectValue
                                    placeholder="Deployment"
                                    key={value}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {globalDeployments.data
                                      ?.filter((d) => d.id !== deploymentId)
                                      .map((deployment) => (
                                        <SelectItem
                                          key={deployment.id}
                                          value={deployment.id}
                                        >
                                          {deployment.name}
                                        </SelectItem>
                                      ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`releaseDependencies.${index}.releaseFilter`}
                        render={({ field: { value, onChange } }) => (
                          <FormItem>
                            <FormControl>
                              <ReleaseConditionDialog
                                condition={value ?? defaultCondition}
                                onChange={onChange}
                              >
                                <Button variant="ghost" size="icon">
                                  {value == null && (
                                    <IconFilterExclamation className="h-4 w-4" />
                                  )}
                                  {value != null && (
                                    <IconFilterFilled className="h-4 w-4" />
                                  )}
                                </Button>
                              </ReleaseConditionDialog>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-16"
                    onClick={() =>
                      append({ deploymentId: "", releaseFilter: null })
                    }
                  >
                    Add
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field: { value, onChange } }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Select value={value} onValueChange={onChange}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ReleaseStatus.Ready}>
                              Ready
                            </SelectItem>
                            <SelectItem value={ReleaseStatus.Building}>
                              Building
                            </SelectItem>
                            <SelectItem value={ReleaseStatus.Failed}>
                              Failed
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            {formErrors?.root?.message && (
              <div className="text-sm text-red-500">
                {formErrors.root.message}
              </div>
            )}

            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
          <FormRootError />
        </Form>
      </DialogContent>
    </Dialog>
  );
};
