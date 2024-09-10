"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { TbCheck } from "react-icons/tb";
import slugify from "slugify";
import { z } from "zod";

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
  FormRootMessage,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";
import { safeFormAwait } from "~/utils/error/safeAwait";

const workspaceForm = z.object({
  name: z
    .string()
    .min(3, { message: "Workspace name must be at least 3 characters long." })
    .max(30, { message: "Workspace Name must be at most 30 characters long." }),
  slug: z
    .string()
    .min(3, { message: "URL must be at least 3 characters long." })
    .max(30, { message: "URL must be at most 30 characters long." })
    .refine((slug) => slug === slugify(slug, { lower: true }), {
      message: "Must be a valid URL",
    }),
});

export default function WorkspaceJoin() {
  const { data: session } = useSession();
  const create = api.workspace.create.useMutation();
  const form = useForm({
    disabled: create.isPending,
    schema: workspaceForm,
    defaultValues: { name: "", slug: "" },
  });

  const { name } = form.watch();
  useEffect(
    () => form.setValue("slug", slugify(name, { lower: true })),
    [form, name],
  );

  const router = useRouter();
  const onSubmit = form.handleSubmit(async (data) => {
    const [_, error] = await safeFormAwait(create.mutateAsync(data), form, {
      entityName: "workspace",
    });
    if (error != null) return;
    router.push(`/${data.slug}`);
  });

  return (
    <>
      <div className="flex justify-end p-6">
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto rounded-md p-2 px-4 text-left text-sm hover:bg-neutral-800/70">
            <div className="text-muted-foreground">Logged in as:</div>
            <div>{session?.user.email}</div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[250px]">
            <DropdownMenuItem className="flex items-center gap-2 p-2">
              <div className="flex-grow">{session?.user.email}</div>
              <TbCheck className="text-green-400" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-muted-foreground"
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
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormRootMessage />
              <Button
                disabled={create.isPending}
                size="lg"
                className="mt-10 w-full font-semibold"
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
