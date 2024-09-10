"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TbTrash } from "react-icons/tb";
import { valid } from "semver";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
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
  FormRootMessage,
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
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";
import { safeFormAwait } from "~/utils/error/safeAwait";

const releaseDependency = z.object({
  targetLabelGroupId: z.string().uuid().optional(),
  deploymentId: z.string().uuid(),
  rule: z.string().min(1).max(255),
  ruleType: z.enum(["semver", "regex"]),
});

const releaseForm = z.object({
  systemId: z.string().uuid(),
  deploymentId: z.string().uuid(),
  version: z.string().min(1).max(255),
  releaseDependencies: z.array(releaseDependency),
});

export const CreateReleaseDialog: React.FC<{
  deploymentId?: string;
  systemId?: string;
  children?: React.ReactNode;
  version?: string;
  onClose?: () => void;
}> = ({ children, ...props }) => {
  const create = api.release.create.useMutation();
  const form = useForm({
    schema: releaseForm,
    defaultValues: {
      deploymentId: props.deploymentId ?? "",
      systemId: props.systemId ?? "",
      version: props.version ?? "",
      releaseDependencies: [],
    },
  });

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
  const targetLabelGroups = api.target.labelGroup.groups.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.data != null && workspace.data.id !== "" },
  );
  const latestRelease = api.release.list.useQuery(
    { deploymentId, limit: 1 },
    { enabled: deploymentId !== "" },
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
    const [release, error] = await safeFormAwait(
      create.mutateAsync(data),
      form,
      { entityName: "release" },
    );
    if (error != null) return;

    await utils.release.list.invalidate({ deploymentId: release.deploymentId });

    const deployment = deployments.data?.find(
      (d) => d.id === data.deploymentId,
    );
    const system = systems.data?.items.find((s) => s.id === data.systemId);
    router.push(
      `/${workspaceSlug}/systems/${system?.slug}/deployments/${deployment?.slug}/releases/${release.id}`,
    );
    setOpen(false);

    const numOfJobConfigs = release.jobConfigs.length;
    toast(
      numOfJobConfigs === 0
        ? `No targets to deploy release too.`
        : `Dispatching ${release.jobConfigs.length} job configuration${release.jobConfigs.length > 1 ? "s" : ""}.`,
      {
        dismissible: true,
        duration: 2_000,
      },
    );

    props.onClose?.();
    setOpen(false);
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "releaseDependencies",
  });

  useEffect(() => {
    if (latestRelease.data != null)
      latestRelease.data.at(0)?.releaseDependencies.forEach((rd) => {
        append({
          ...rd,
          targetLabelGroupId: rd.targetLabelGroupId ?? undefined,
        });
      });
  }, [latestRelease.data, append, deploymentId]);

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

            <div className="flex flex-col space-y-3">
              <Label>Release Dependencies</Label>

              {fields.map((_, index) => (
                <Card className="space-y-2 p-2" key={index}>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name={`releaseDependencies.${index}.deploymentId`}
                      render={({ field: { value, onChange } }) => (
                        <FormItem className="col-span-1">
                          <Select value={value} onValueChange={onChange}>
                            <SelectTrigger className="h-8 text-sm">
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
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`releaseDependencies.${index}.targetLabelGroupId`}
                      render={({ field: { value, onChange } }) => (
                        <FormItem className="col-span-1">
                          <Select value={value} onValueChange={onChange}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Label Group" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {targetLabelGroups.data?.map((group) => (
                                  <SelectItem
                                    key={group.targetLabelGroup.id}
                                    value={group.targetLabelGroup.id}
                                  >
                                    {group.targetLabelGroup.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex">
                    <FormField
                      control={form.control}
                      name={`releaseDependencies.${index}.ruleType`}
                      render={({ field: { value, onChange } }) => (
                        <FormItem>
                          <Select value={value} onValueChange={onChange}>
                            <SelectTrigger className="h-8 w-36 rounded-r-none text-sm">
                              <SelectValue placeholder="Validation" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup className="w-36">
                                <SelectItem value="semver">Semver</SelectItem>
                                <SelectItem value="regex">Regex</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`releaseDependencies.${index}.rule`}
                      render={({ field }) => (
                        <Input
                          className="h-8 w-full rounded-l-none text-sm"
                          {...field}
                        />
                      )}
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 h-8 w-8"
                      onClick={() => remove(index)}
                    >
                      <TbTrash />
                    </Button>
                  </div>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-16"
                onClick={() =>
                  append({
                    deploymentId: "",
                    rule: "",
                    ruleType:
                      valid(latestRelease.data?.at(0)?.version) != null
                        ? "semver"
                        : "regex",
                  })
                }
              >
                Add
              </Button>
            </div>

            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
          <FormRootMessage />
        </Form>
      </DialogContent>
    </Dialog>
  );
};
