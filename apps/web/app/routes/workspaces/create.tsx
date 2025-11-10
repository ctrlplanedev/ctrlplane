import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";

// Validation schema for workspace creation
const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(3, {
      message: "Workspace name must be at least 3 characters long.",
    })
    .max(30, {
      message: "Workspace name must be at most 30 characters long.",
    }),
  slug: z
    .string()
    .min(3, {
      message: "Workspace slug must be at least 3 characters long.",
    })
    .max(50, {
      message: "Workspace slug must be at most 50 characters long.",
    })
    .regex(/^[a-z0-9-]+$/, {
      message:
        "Workspace slug can only contain lowercase letters, numbers, and hyphens",
    }),
});

type CreateWorkspaceFormData = z.infer<typeof createWorkspaceSchema>;

export default function CreateWorkspace() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const form = useForm<CreateWorkspaceFormData>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const createWorkspace = trpc.workspace.create.useMutation({
    onSuccess: async (workspace) => {
      toast.success("Workspace created successfully");
      await utils.user.session.invalidate();
      navigate(`/${workspace.slug}/deployments`);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsSubmitting(false);
    },
  });

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    form.setValue("name", value);
    // Auto-generate slug from name (convert to lowercase, replace spaces/special chars with hyphens)
    const autoSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!form.formState.dirtyFields.slug) {
      form.setValue("slug", autoSlug);
    }
  };

  const onSubmit = (data: CreateWorkspaceFormData) => {
    setIsSubmitting(true);
    createWorkspace.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create a Workspace</CardTitle>
          <CardDescription>
            Get started by creating your first workspace. You can invite team
            members and manage deployments from here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="My Workspace"
                        {...field}
                        onChange={(e) => handleNameChange(e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      A friendly name for your workspace
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="my-workspace" {...field} />
                    </FormControl>
                    <FormDescription>
                      Used in URLs (lowercase letters, numbers, and hyphens
                      only)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Workspace"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
