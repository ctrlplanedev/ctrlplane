import { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { DeleteSystemDialog } from "~/app/[workspaceSlug]/(app)/_components/system/DeleteSystemDialog";
import { api } from "~/trpc/server";
import { SystemBreadcrumb } from "../_components/SystemBreadcrumb";
import { GeneralSettings } from "./GeneralSettings";

export const generateMetadata = async (props: {
  params: { workspaceSlug: string; systemSlug: string };
}): Promise<Metadata> => {
  try {
    const system = await api.system.bySlug(props.params);
    return {
      title: `Settings | ${system.name} | Ctrlplane`,
      description: `Configure settings for the ${system.name} system in Ctrlplane.`
    };
  } catch (error) {
    return {
      title: "System Settings | Ctrlplane",
      description: "Configure system settings in Ctrlplane."
    };
  }
};

export default async function SystemSettingsPage(props: {
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const params = await props.params;
  const system = await api.system.bySlug(params).catch(() => notFound());
  return (
    <div className="flex flex-col">
      <PageHeader>
        <SystemBreadcrumb system={system} page="Settings" />
      </PageHeader>

      <div className="container max-w-2xl space-y-8 overflow-y-auto py-8">
        <div className="space-y-3">
          <div>General</div>
          <GeneralSettings system={system} />
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="text-red-500">Danger Zone</div>

          <div className="text-sm text-muted-foreground">
            Permanently delete this system and all of its data. This action
            cannot be undone.
          </div>

          <DeleteSystemDialog system={system}>
            <Button variant="destructive">Delete System</Button>
          </DeleteSystemDialog>
        </div>
      </div>
    </div>
  );
}
