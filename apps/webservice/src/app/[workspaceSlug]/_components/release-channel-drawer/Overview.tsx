import type * as SCHEMA from "@ctrlplane/db/schema";
import type React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
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

import { api } from "~/trpc/react";

type OverviewProps = {
  releaseChannel: SCHEMA.ReleaseChannel;
};

const schema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
});

export const Overview: React.FC<OverviewProps> = ({ releaseChannel }) => {
  const defaultValues = {
    name: releaseChannel.name,
    description: releaseChannel.description ?? undefined,
  };
  const form = useForm({ schema, defaultValues });
  const router = useRouter();
  const utils = api.useUtils();

  const updateReleaseChannel =
    api.deployment.releaseChannel.update.useMutation();
  const onSubmit = form.handleSubmit((data) =>
    updateReleaseChannel
      .mutateAsync({ id: releaseChannel.id, data })
      .then(() => form.reset(data))
      .then(() =>
        utils.deployment.releaseChannel.byId.invalidate(releaseChannel.id),
      )
      .then(() => router.refresh()),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6 p-6">
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

        <Button
          type="submit"
          disabled={updateReleaseChannel.isPending || !form.formState.isDirty}
        >
          Save
        </Button>
      </form>
    </Form>
  );
};
