import { useState } from "react";
import { Link } from "react-router";
import { useDebounce } from "react-use";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import CelExpressionInput from "../_components/CelExpiressionInput";
import { ResourceRow } from "../resources/_components/ResourceRow";
import { useEnvironment } from "./_components/EnvironmentProvider";
import { EnvironmentsNavbarTabs } from "./_components/EnvironmentsNavbarTabs";

export default function EnvironmentResources() {
  const { workspace } = useWorkspace();
  const { environment } = useEnvironment();

  const [filter, setFilter] = useState(
    environment.resourceSelector?.cel ?? "true",
  );
  const [filterDebounced, setFilterDebounced] = useState(filter);
  useDebounce(
    () => {
      setFilterDebounced(filter);
    },
    1_000,
    [filter],
  );
  const resourcesQuery = trpc.resource.list.useQuery({
    workspaceId: workspace.id,
    selector: { cel: filterDebounced },
    limit: 200,
    offset: 0,
  });

  const updateEnvironment = trpc.environment.update.useMutation();
  const onResourceSelectorChange = async (filter: string) => {
    setFilter(filter);
    await updateEnvironment.mutateAsync({
      workspaceId: workspace.id,
      environmentId: environment.id,
      data: { resourceSelectorCel: filter },
    });
  };

  const resources = resourcesQuery.data?.items ?? [];
  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbItem>
                  <Link to={`/${workspace.slug}/environments`}>
                    Environments
                  </Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <Link
                    to={`/${workspace.slug}/environments/${environment.id}`}
                  >
                    {environment.name}
                  </Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbPage>Resources</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <EnvironmentsNavbarTabs environmentId={environment.id} />
      </header>

      <div className="flex items-center justify-between gap-2 border-b p-2">
        <div className="flex-1 rounded-md border border-input p-0.5">
          <CelExpressionInput
            height="2.5rem"
            value={filter}
            onChange={(v) => setFilter(v ?? "true")}
          />
        </div>
        <Button
          className="h-[2.5rem]"
          onClick={async () => {
            await onResourceSelectorChange(filter);
            toast.success(
              "Environment resource selector updated successfully.",
            );
          }}
        >
          Save
        </Button>
      </div>

      {resources.map((resource) => (
        <ResourceRow key={resource.identifier} resource={resource} />
      ))}
    </>
  );
}
