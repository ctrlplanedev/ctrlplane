import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { PageHeader } from "../../../_components/PageHeader";

export const metadata = {
  title: "Resource Providers - Ctrlplane",
};

export default function ProvidersPage() {
  return (
    <div>
      <PageHeader>
        <SidebarTrigger name={Sidebars.Resources} />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage>Providers</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-neutral-800 p-4">
          <h3 className="mb-2 text-lg font-medium">AWS</h3>
          <p className="text-sm text-muted-foreground">
            Amazon Web Services cloud provider integration
          </p>
        </div>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="mb-2 text-lg font-medium">GCP</h3>
              <p className="text-sm text-muted-foreground">
                Google Cloud Platform provider integration
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-sm text-yellow-500">Syncing...</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
              <span>Last synced 5m ago</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
              <span>125 resources</span>
            </div>
          </div>

          <Button variant="outline" className="mt-4">
            Configure Sync
          </Button>
        </Card>

        <div className="rounded-lg border border-neutral-800 p-4">
          <h3 className="mb-2 text-lg font-medium">Azure</h3>
          <p className="text-sm text-muted-foreground">
            Microsoft Azure cloud provider integration
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 p-4">
          <h3 className="mb-2 text-lg font-medium">Kubernetes</h3>
          <p className="text-sm text-muted-foreground">
            Container orchestration platform integration
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 p-4">
          <h3 className="mb-2 text-lg font-medium">GitHub</h3>
          <p className="text-sm text-muted-foreground">
            Source control and CI/CD integration
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 p-4">
          <h3 className="mb-2 text-lg font-medium">GitLab</h3>
          <p className="text-sm text-muted-foreground">
            DevOps platform integration
          </p>
        </div>
      </div>
    </div>
  );
}
