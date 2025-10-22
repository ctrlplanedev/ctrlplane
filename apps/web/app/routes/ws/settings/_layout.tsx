import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { buttonVariants } from "~/components/ui/button";
import { useWorkspace } from "~/components/WorkspaceProvider";

export default function SettingsLayout() {
  const { workspace } = useWorkspace();
  const path = useLocation();
  const navigate = useNavigate();

  if (path.pathname === `/${workspace.slug}/settings`) {
    navigate(`/${workspace.slug}/settings/general`);
  }

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
    <div className="container mx-auto flex max-w-6xl gap-8 py-20">
      <div className="flex flex-shrink-0 flex-col gap-2">
        <NavLink
          to={`/${workspace.slug}/settings/general`}
          className={
            isActive(`/${workspace.slug}/settings/general`)
              ? activeLinkStyle
              : defaultLinkStyle
          }
        >
          General
        </NavLink>
        <NavLink
          to={`/${workspace.slug}/settings/members`}
          className={
            isActive(`/${workspace.slug}/settings/members`)
              ? activeLinkStyle
              : defaultLinkStyle
          }
        >
          Members
        </NavLink>
        <NavLink
          to={`/${workspace.slug}/settings/api-keys`}
          className={
            isActive(`/${workspace.slug}/settings/api-keys`)
              ? activeLinkStyle
              : defaultLinkStyle
          }
        >
          API Keys
        </NavLink>
        <NavLink
          to={`/${workspace.slug}/settings/delete-workspace`}
          className={
            isActive(`/${workspace.slug}/settings/delete-workspace`)
              ? activeLinkStyle
              : defaultLinkStyle
          }
        >
          Delete Workspace
        </NavLink>
      </div>
      <div className="flex-grow">
        <Outlet />
      </div>
    </div>
  );
}
