"use client";

import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IconExternalLink, IconFilter } from "@tabler/icons-react";
import LZString from "lz-string";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
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
  FormMessage,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";
import { toast } from "@ctrlplane/ui/toast";
import {
  defaultCondition,
  deploymentVersionCondition,
  isEmptyCondition,
  isValidDeploymentVersionCondition,
} from "@ctrlplane/validators/releases";

import { DeploymentVersionConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionBadge";
import { DeploymentVersionConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionDialog";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

type CreateDeploymentVersionChannelDialogProps = {
  deploymentId: string;
  children: React.ReactNode;
};

const getFinalSelector = (selector?: DeploymentVersionCondition) =>
  selector && !isEmptyCondition(selector) ? selector : undefined;

const schema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
  versionSelector: deploymentVersionCondition
    .optional()
    .refine((cond) => cond == null || isValidDeploymentVersionCondition(cond)),
});

export const CreateDeploymentVersionChannelDialog: React.FC<
  CreateDeploymentVersionChannelDialogProps
> = ({ deploymentId, children }) => {
  const [open, setOpen] = useState(false);
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  const createDeploymentVersionChannel =
    api.deployment.version.channel.create.useMutation();
  const router = useRouter();

  const form = useForm({ schema });
  const onSubmit = form.handleSubmit((data) => {
    const selector = getFinalSelector(data.versionSelector);
    createDeploymentVersionChannel
      .mutateAsync({ ...data, deploymentId, versionSelector: selector })
      .then(() => form.reset(data))
      .then(() => router.refresh())
      .then(() => setOpen(false))
      .catch((error) => toast.error(error.message));
  });

  const { versionSelector } = form.watch();
  const selector = getFinalSelector(versionSelector);

  const selectorHash =
    selector != null
      ? LZString.compressToEncodedURIComponent(JSON.stringify(selector))
      : undefined;

  const baseUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug)
    .releases();
  const versionSelectorUrl =
    selectorHash != null ? `${baseUrl}?selector=${selectorHash}` : baseUrl;

  const versionsQ = api.deployment.version.list.useQuery(
    { deploymentId, filter: selector, limit: 5 },
    { enabled: selector != null, placeholderData: (prev) => prev },
  );
  const versions = versionsQ.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Deployment Version Channel</DialogTitle>
        </DialogHeader>

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
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="versionSelector"
              render={({ field: { value, onChange } }) => (
                <FormItem className="space-y-2">
                  <FormLabel>
                    Version Selector ({versions?.total ?? "-"})
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

            <DialogFooter>
              <Button
                type="submit"
                disabled={createDeploymentVersionChannel.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
