import type { RouterOutputs } from "@ctrlplane/api";
import { z } from "zod";

import { directoryPath } from "@ctrlplane/db/schema";
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
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";
import { MetadataInfo } from "../../MetadataInfo";

const name = z.string().min(1).max(100);
const description = z.string().max(1000).nullable();
const schema = z.object({ name, description, directory: directoryPath });
type OverviewProps = {
  environment: NonNullable<RouterOutputs["environment"]["byId"]>;
};

export const Overview: React.FC<OverviewProps> = ({ environment }) => {
  const defaultValues = { ...environment };
  const form = useForm({ schema, defaultValues });
  const update = api.environment.update.useMutation();

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
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add a description..."
                  value={value ?? ""}
                  onChange={onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="directory"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel>Directory</FormLabel>
              <FormControl>
                <Input
                  placeholder="my/env/path"
                  value={value}
                  className="font-mono"
                  onChange={onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={update.isPending || !form.formState.isDirty}
          >
            Save
          </Button>
        </div>

        <div>
          <div className="mb-2 text-sm">
            Metadata ({Object.keys(environment.metadata).length})
          </div>
          <div className="text-xs">
            <MetadataInfo metadata={environment.metadata} />
          </div>
        </div>
      </form>
    </Form>
  );
};
