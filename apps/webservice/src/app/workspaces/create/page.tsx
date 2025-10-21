"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCheck } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import slugify from "slugify";
import { z } from "zod";

import { authClient, signOut } from "@ctrlplane/auth";
import { workspaceSchema } from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

const workspaceForm = z.object(workspaceSchema.shape);
type WorkspaceFormValues = z.infer<typeof workspaceForm>;

export default function WorkspaceCreate() {
  const { data: session } = authClient.useSession();
  const create = api.workspace.create.useMutation();
  const router = useRouter();

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceForm),
    defaultValues: { name: "", slug: "" },
  });

  const { handleSubmit, watch, setValue, setError } = form;

  watch((data, { name: fieldName }) => {
    if (fieldName === "name")
      setValue("slug", slugify(data.name ?? "", { lower: true }));
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await create.mutateAsync(data);
      router.push(urls.workspace(data.slug).baseUrl());
    } catch {
      setError("root", {
        message: "Workspace with this name already exists",
        type: "manual",
      });
    }
  });

  if (session == null) {
    router.push("/login");
    return null;
  }

  return (
    <>
      <div className="flex justify-end p-6">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="ml-auto rounded-md p-2 px-4 text-left text-sm hover:bg-neutral-800/70"
            data-testid="user-email"
          >
            <div className="text-muted-foreground">Logged in as:</div>
            <div>{session.user.email}</div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[250px]">
            <DropdownMenuItem className="flex items-center gap-2 p-2">
              <div className="flex-grow">{session.user.email}</div>
              <IconCheck className="h-4 w-4 text-green-400" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-muted-foreground"
              data-testid="logout-button"
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="container m-auto max-w-lg space-y-8 py-20">
        <h1 className="text-center text-2xl">Create a new workspace</h1>
        <p className="text-center text-muted-foreground">
          Workspaces are shared environments where teams can create systems and
          deployments.
        </p>
        <Form {...form}>
          <Card className="p-8">
            <form onSubmit={onSubmit} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace URL</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="slug" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormRootError />
              <Button
                disabled={create.isPending}
                size="lg"
                className="mt-10 w-full font-semibold"
                data-testid="submit"
              >
                Create workspace
              </Button>
            </form>
          </Card>
        </Form>
      </div>
    </>
  );
}
