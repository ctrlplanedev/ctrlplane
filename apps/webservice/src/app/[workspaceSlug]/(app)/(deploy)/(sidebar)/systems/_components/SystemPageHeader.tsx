import type * as SCHEMA from "@ctrlplane/db/schema";
import { IconMenu2, IconPlus, IconTopologyComplex } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/CreateDeployment";
import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { CreateSystemDialog } from "../CreateSystem";

export const SystemPageHeader: React.FC<{
  workspace: SCHEMA.Workspace;
}> = ({ workspace }) => (
  <PageHeader className="z-20 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <SidebarTrigger name={Sidebars.Deployments}>
        <IconMenu2 className="h-4 w-4" />
      </SidebarTrigger>
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbPage className="flex items-center gap-1.5">
              <IconTopologyComplex className="h-4 w-4" />
              Systems
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>

    <div className="flex items-center gap-2">
      <CreateSystemDialog workspace={workspace}>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5"
        >
          <IconPlus className="h-3.5 w-3.5" />
          New System
        </Button>
      </CreateSystemDialog>
      <CreateDeploymentDialog>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5"
        >
          <IconPlus className="h-3.5 w-3.5" />
          New Deployment
        </Button>
      </CreateDeploymentDialog>
    </div>
  </PageHeader>
);
