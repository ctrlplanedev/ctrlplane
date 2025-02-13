"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ReleaseCondition } from "@ctrlplane/validators/releases";
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
import {
  defaultCondition,
  isEmptyCondition,
  isValidReleaseCondition,
  releaseCondition,
} from "@ctrlplane/validators/releases";

import { ReleaseConditionBadge } from "~/app/[workspaceSlug]/(appv2)/_components/release/condition/ReleaseConditionBadge";
import { ReleaseConditionDialog } from "~/app/[workspaceSlug]/(appv2)/_components/release/condition/ReleaseConditionDialog";
import { api } from "~/trpc/react";

type CreateReleaseChannelDialogProps = {
  deploymentId: string;
  releaseChannels: SCHEMA.ReleaseChannel[];
  children: React.ReactNode;
};

const getFinalFilter = (filter?: ReleaseCondition) =>
  filter && !isEmptyCondition(filter) ? filter : undefined;

export const CreateReleaseChannelDialog: React.FC<
  CreateReleaseChannelDialogProps
> = ({ deploymentId, children, releaseChannels }) => {
  // schema needs to be in the component scope to use the releaseChannels
  // to validate the name uniqueness
  const schema = z.object({
    name: z
      .string()
      .min(1)
      .max(50)
      .refine(
        (name) => !releaseChannels.some((rc) => rc.name === name),
        "Release channel name must be unique",
      ),
    description: z.string().max(1000).optional(),
    releaseFilter: releaseCondition
      .optional()
      .refine((cond) => cond == null || isValidReleaseCondition(cond)),
  });

  const [open, setOpen] = useState(false);
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  const createReleaseChannel =
    api.deployment.releaseChannel.create.useMutation();
  const router = useRouter();

  const form = useForm({ schema });
  const onSubmit = form.handleSubmit((data) => {
    const filter = getFinalFilter(data.releaseFilter);
    createReleaseChannel
      .mutateAsync({ ...data, deploymentId, releaseFilter: filter })
      .then(() => form.reset(data))
      .then(() => router.refresh())
      .then(() => setOpen(false));
  });

  const { releaseFilter } = form.watch();
  const filter = getFinalFilter(releaseFilter);

  const filterHash =
    filter != null
      ? LZString.compressToEncodedURIComponent(JSON.stringify(filter))
      : undefined;

  const baseUrl = `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}`;
  const releaseFilterUrl =
    filterHash != null
      ? `${baseUrl}/releases?filter=${filterHash}`
      : `${baseUrl}/releases`;

  const releasesQ = api.release.list.useQuery(
    { deploymentId, filter, limit: 5 },
    { enabled: filter != null, placeholderData: (prev) => prev },
  );
  const releases = releasesQ.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Release Channel</DialogTitle>
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
              name="releaseFilter"
              render={({ field: { value, onChange } }) => (
                <FormItem className="space-y-2">
                  <FormLabel>
                    Release Filter ({releases?.total ?? "-"})
                  </FormLabel>
                  {value != null && <ReleaseConditionBadge condition={value} />}
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <ReleaseConditionDialog
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
                          Edit filter
                        </Button>
                      </ReleaseConditionDialog>

                      <Link href={releaseFilterUrl} target="_blank">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className="flex items-center gap-2"
                        >
                          <IconExternalLink className="h-4 w-4" />
                          View releases
                        </Button>
                      </Link>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={createReleaseChannel.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
