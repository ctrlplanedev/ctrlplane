import { Link, NavLink, Outlet, useLocation } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { buttonVariants } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useEnvironment } from "../_components/EnvironmentProvider";
import { EnvironmentsNavbarTabs } from "../_components/EnvironmentsNavbarTabs";

export default function EnvironmentsSettingsLayout() {
  const { workspace } = useWorkspace();
  const { environment } = useEnvironment();
  const path = useLocation();
  const baseUrl = `/${workspace.slug}/environments/${environment.id}/settings`;

  const isActive = (pathname: string) => path.pathname.startsWith(pathname);

  const defaultLinkStyle = buttonVariants({
    variant: "ghost",
    className: "w-full justify-start text-muted-foreground",
  });

  const activeLinkStyle = buttonVariants({
    variant: "ghost",
    className: "w-full justify-start bg-muted text-primary",
  });

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
                <BreadcrumbPage>Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-4">
          <EnvironmentsNavbarTabs environmentId={environment.id} />
        </div>
      </header>
      <div className="container mx-auto flex max-w-6xl gap-8 py-20">
        <div className="flex flex-shrink-0 flex-col gap-2">
          <NavLink
            to={`${baseUrl}`}
            className={
              isActive(`${baseUrl}`) ? activeLinkStyle : defaultLinkStyle
            }
          >
            General
          </NavLink>
          <NavLink
            to={`${baseUrl}/job-agent`}
            className={
              isActive(`${baseUrl}/job-agent`)
                ? activeLinkStyle
                : defaultLinkStyle
            }
          >
            Job Agent
          </NavLink>
          <NavLink
            to={`${baseUrl}/hooks`}
            className={
              isActive(`${baseUrl}/hooks`) ? activeLinkStyle : defaultLinkStyle
            }
          >
            Hooks
          </NavLink>
        </div>
        <div className="flex-grow">
          <Outlet />
        </div>
      </div>
    </>
  );
}
