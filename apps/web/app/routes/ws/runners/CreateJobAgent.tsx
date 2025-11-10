import { zodResolver } from "@hookform/resolvers/zod";
import { SiArgo } from "@icons-pack/react-simple-icons";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";

const argocdSchema = z.object({
  serverUrl: z.string().url(),
  apiKey: z.string(),
});

function ArgoCDDialog({ children }: { children: React.ReactNode }) {
  const form = useForm({
    resolver: zodResolver(argocdSchema),
    defaultValues: { serverUrl: "", apiKey: "" },
  });

  const onSubmit = form.handleSubmit((data) => {
    console.log(data);
  });

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
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateJobAgent() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Create Agent</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <ArgoCDDialog>
          <DropdownMenuItem
            className="flex items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <SiArgo className="size-4 text-orange-400" />
            Argo CD
          </DropdownMenuItem>
        </ArgoCDDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
