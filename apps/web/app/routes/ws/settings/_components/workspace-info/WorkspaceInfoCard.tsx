import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { WorkspaceInfoFormData } from "./workspaceInfoSchema";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Form } from "~/components/ui/form";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { CopyWorkspaceID } from "./CopyWorkspaceID";
import { useUpdateWorkspace } from "./useUpdateWorkspace";
import {
  WorkspaceNameField,
  WorkspaceSlugField,
} from "./WorkspaceInfoFormFields";
import { workspaceInfoSchema } from "./workspaceInfoSchema";

export function WorkspaceInfoCard() {
  const { workspace } = useWorkspace();
  const updateWorkspace = useUpdateWorkspace();

  const form = useForm<WorkspaceInfoFormData>({
    resolver: zodResolver(workspaceInfoSchema),
    defaultValues: { name: workspace.name, slug: workspace.slug },
  });

  const { isDirty } = form.formState;

  const onSubmit = (data: WorkspaceInfoFormData) =>
    updateWorkspace
      .mutateAsync({ workspaceId: workspace.id, data })
      .then(() => toast.success("Workspace updated queued"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Information</CardTitle>
        <CardDescription>
          Update your workspace name and URL slug
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <CopyWorkspaceID />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <WorkspaceNameField form={form} />
            <WorkspaceSlugField form={form} />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={!isDirty || updateWorkspace.isPending}
              >
                Reset
              </Button>
              <Button
                type="submit"
                disabled={!isDirty || updateWorkspace.isPending}
              >
                {updateWorkspace.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
