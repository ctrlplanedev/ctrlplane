"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useCopyToClipboard } from "react-use";
import { z } from "zod";

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
import { Label } from "@ctrlplane/ui/label";

import { api } from "~/trpc/react";

const updateWorkspace = z.object({
  name: z.string(),
  slug: z.string(),
});

export const WorkspaceUpdateSection: React.FC = () => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);

  const form = useForm({
    schema: updateWorkspace,
    defaultValues: { name: "", slug: "" },
  });

  useEffect(() => {
    const { data } = workspace;
    if (data == null) return;
    if (form.getValues("name") !== "") return;
    form.setValue("name", data.name);
    form.setValue("slug", data.slug);
  }, [form, workspace]);

  const router = useRouter();
  const update = api.workspace.update.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    if (workspace.data == null) return;
    await update.mutateAsync({ id: workspace.data.id, data });
    router.push(`/${data.slug}/settings/workspace/general`);
    router.refresh();
  });

  const [isCopied, setIsCopied] = useState(false);
  const [, copy] = useCopyToClipboard();
  const handleCopy = () => {
    copy(workspace.data?.id ?? "");
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  };
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Workspace ID</Label>
          <div className="flex items-center gap-2">
            <Input
              value={workspace.data?.id}
              disabled
              className="max-w-[350px]"
            />
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={handleCopy}
                className="absolute -left-9 -top-2 h-4 w-4 bg-neutral-950 backdrop-blur-sm transition-all hover:bg-neutral-950 focus-visible:ring-0"
              >
                {isCopied ? (
                  <IconCheck className="h-4 w-4 bg-neutral-950 text-green-500" />
                ) : (
                  <IconCopy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} className="max-w-[250px]" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input {...field} className="max-w-[250px]" />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit">Update</Button>
      </form>
    </Form>
  );
};
