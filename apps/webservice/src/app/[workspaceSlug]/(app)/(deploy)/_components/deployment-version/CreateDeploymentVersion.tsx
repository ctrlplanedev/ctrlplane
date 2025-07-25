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
import {
  defaultCondition,
  deploymentVersionCondition,
  DeploymentVersionStatus,
  isEmptyCondition,
} from "@ctrlplane/validators/releases";

import { DeploymentVersionConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionDialog";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

const versionDependency = z.object({
  deploymentId: z.string().uuid(),
  versionSelector: deploymentVersionCondition.nullable(),
});

const versionForm = z.object({
  systemId: z.string().uuid(),
  deploymentId: z.string().uuid(),
  tag: z.string().min(1).max(255),
  status: z.nativeEnum(DeploymentVersionStatus),
  dependencies: z.array(versionDependency).refine((deps) => {
    const deploymentIds = deps.map((d) => d.deploymentId);
    return new Set(deploymentIds).size === deploymentIds.length;
  }, "Cannot reuse a deployment in multiple version dependencies"),
});

export const CreateDeploymentVersionDialog: React.FC<{
  deploymentId?: string;
  systemId?: string;
  children?: React.ReactNode;
  tag?: string;
  onClose?: () => void;
}> = ({ children, ...props }) => {
  const create = api.deployment.version.create.useMutation();
  const form = useForm({
    schema: versionForm,
    defaultValues: {
      deploymentId: props.deploymentId ?? "",
      systemId: props.systemId ?? "",
      tag: props.tag ?? "",
      dependencies: [],
      status: DeploymentVersionStatus.Ready,
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
    const dependencies = data.dependencies.map((dep) => ({
      ...dep,
      versionSelector:
        dep.versionSelector == null || isEmptyCondition(dep.versionSelector)
          ? null
          : dep.versionSelector,
    }));
    const version = await create.mutateAsync({
      ...data,
      dependencies,
      name: data.tag.trim(),
    });
    await utils.deployment.version.list.invalidate({
      deploymentId: version.deploymentId,
    });

    const deployment = deployments.data?.find(
      (d) => d.id === data.deploymentId,
    );
    const system = systems.data?.items.find((s) => s.id === data.systemId);
    const url = urls
      .workspace(workspaceSlug)
      .system(system?.slug ?? "")
      .deployment(deployment?.slug ?? "")
      .release(version.id)
      .baseUrl();
    router.push(url);
    setOpen(false);

    props.onClose?.();
    setOpen(false);
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "dependencies",
  });

  const formErrors = form.formState.errors.dependencies ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>New Version</DialogTitle>
              <DialogDescription>
                A version is a fixed snapshot of a deployment, therefore, all
                necessary assets must be fully prepared before creating a new
                version.
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
              name="tag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tag</FormLabel>
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
                  <Label>Version Dependencies</Label>
                  <span className="text-sm text-muted-foreground">
                    Dependencies must be fulfilled for a resource before this
                    version can be applied to that resource. Read more about
                    version dependencies here.
                  </span>

                  {fields.map((_, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <FormField
                        control={form.control}
                        name={`dependencies.${index}.deploymentId`}
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
                        name={`dependencies.${index}.versionSelector`}
                        render={({ field: { value, onChange } }) => (
                          <FormItem>
                            <FormControl>
                              <DeploymentVersionConditionDialog
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
                              </DeploymentVersionConditionDialog>
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
                      append({ deploymentId: "", versionSelector: null })
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
                            <SelectItem value={DeploymentVersionStatus.Ready}>
                              Ready
                            </SelectItem>
                            <SelectItem
                              value={DeploymentVersionStatus.Building}
                            >
                              Building
                            </SelectItem>
                            <SelectItem value={DeploymentVersionStatus.Failed}>
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
