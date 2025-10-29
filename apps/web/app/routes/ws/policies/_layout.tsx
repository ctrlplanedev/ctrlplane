import { Link, Outlet } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { PolicyCreateFormContextProvider } from "./_components/create/PolicyFormContext";
import { PoliciesNavbarTabs } from "./_components/PoliciesNavbarTabs";

export default function PoliciesLayout() {
  const { workspace } = useWorkspace();

  return (
    <PolicyCreateFormContextProvider>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <Link to={`/${workspace.slug}/policies`}>Policies</Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Create</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <div className="container mx-auto max-w-3xl space-y-6">
          <PoliciesNavbarTabs />
          <Outlet />
        </div>
      </main>
    </PolicyCreateFormContextProvider>
  );
}
