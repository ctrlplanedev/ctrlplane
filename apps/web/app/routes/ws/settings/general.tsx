import { useState } from "react";
import { toast } from "sonner";

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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useWorkspace } from "~/components/WorkspaceProvider";

export default function GeneralSettingsPage() {
  const { workspace } = useWorkspace();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [errors, setErrors] = useState<{
    name?: string;
    slug?: string;
  }>({});

  const utils = trpc.useUtils();
  const updateWorkspace = trpc.workspace.update.useMutation({
    onSuccess: () => {
      toast.success("Workspace updated successfully");
      // Invalidate the user session to refetch the updated workspace info
      void utils.user.session.invalidate();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to update workspace";
      toast.error(message);
    },
  });

  const validateForm = () => {
    const newErrors: { name?: string; slug?: string } = {};

    if (!name || name.trim().length === 0) {
      newErrors.name = "Workspace name is required";
    } else if (name.length > 100) {
      newErrors.name = "Workspace name must be less than 100 characters";
    }

    if (!slug || slug.trim().length === 0) {
      newErrors.slug = "Workspace slug is required";
    } else if (!/^[a-z0-9-]+$/.test(slug)) {
      newErrors.slug =
        "Workspace slug can only contain lowercase letters, numbers, and hyphens";
    } else if (slug.length < 3) {
      newErrors.slug = "Workspace slug must be at least 3 characters";
    } else if (slug.length > 50) {
      newErrors.slug = "Workspace slug must be less than 50 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const data: { name?: string; slug?: string } = {};
    if (name !== workspace.name) data.name = name;
    if (slug !== workspace.slug) data.slug = slug;

    updateWorkspace.mutate({
      workspaceId: workspace.id,
      data,
    });
  };

  const hasChanges = name !== workspace.name || slug !== workspace.slug;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">General Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your workspace settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace Information</CardTitle>
          <CardDescription>
            Update your workspace name and URL slug
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="workspace-name">Workspace Name</FieldLabel>
                <FieldContent>
                  <Input
                    id="workspace-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Workspace"
                    aria-invalid={!!errors.name}
                  />
                  <FieldDescription>
                    The display name for your workspace
                  </FieldDescription>
                  {errors.name && <FieldError>{errors.name}</FieldError>}
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="workspace-slug">Workspace Slug</FieldLabel>
                <FieldContent>
                  <Input
                    id="workspace-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    placeholder="my-workspace"
                    aria-invalid={!!errors.slug}
                  />
                  <FieldDescription>
                    The URL-friendly identifier for your workspace. Used in URLs
                    like /{slug}/...
                  </FieldDescription>
                  {errors.slug && <FieldError>{errors.slug}</FieldError>}
                </FieldContent>
              </Field>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setName(workspace.name);
                    setSlug(workspace.slug);
                    setErrors({});
                  }}
                  disabled={!hasChanges || updateWorkspace.isPending}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={!hasChanges || updateWorkspace.isPending}
                >
                  {updateWorkspace.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
