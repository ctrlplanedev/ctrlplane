import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { useWorkspace } from "~/components/WorkspaceProvider";

const argocdSchema = z.object({
  name: z.string().min(1),
  serverUrl: z.string().url(),
  apiKey: z.string(),
});

export function ArgoCDDialog({ children }: { children: React.ReactNode }) {
  const { workspace } = useWorkspace();
  const form = useForm({
    resolver: zodResolver(argocdSchema),
    defaultValues: { name: "", serverUrl: "", apiKey: "" },
  });

  const { mutateAsync, isPending } = trpc.jobAgents.create.useMutation();

  const onSubmit = form.handleSubmit((data) =>
    mutateAsync({
      workspaceId: workspace.id,
      name: data.name,
      type: "argo-cd",
      config: { serverUrl: data.serverUrl, apiKey: data.apiKey },
    }).then(() => toast.success("Job agent creation queued successfully")),
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Argo CD</DialogTitle>
          <DialogDescription>
            Configure an Argo CD runner to deploy applications to your argo
            server.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serverUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server URL</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={isPending || !form.formState.isDirty}
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
