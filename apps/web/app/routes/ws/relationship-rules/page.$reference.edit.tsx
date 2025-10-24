import { Separator } from "@radix-ui/react-separator";
import { Link, useParams } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { EditRelationshipRule } from "./_components/EditRelationshipRule";

export function meta() {
  return [
    { title: "Edit Relationship Rule - Ctrlplane" },
    {
      name: "description",
      content: "Edit an existing relationship rule",
    },
  ];
}

export default function PageEdit() {
  const { workspace } = useWorkspace();
  const { ruleId } = useParams();

  if (!ruleId) {
    return <div>Invalid rule ID</div>;
  }

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
                <Link to={`/${workspace.slug}/relationship-rules`}>
                  Relationship Rules
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Edit {ruleId}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl p-8">
        <EditRelationshipRule ruleId={ruleId} />
      </div>
    </>
  );
}
