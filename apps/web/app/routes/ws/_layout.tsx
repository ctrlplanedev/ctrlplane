import {
  BadgeCheck,
  Briefcase,
  ChevronRight,
  ChevronsUpDown,
  Cpu,
  Eye,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  LogOut,
  Moon,
  Plug,
  Rocket,
  Server,
  ShieldCheck,
  Sun,
  TreePine,
  Zap,
} from "lucide-react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";

import { authClient } from "~/api/auth-client";
import { trpc } from "~/api/trpc";
import { useTheme } from "~/components/ThemeProvider";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";
import { WorkspaceSelector } from "./_components/WorkspaceSelector";

// Navigation groups
const navigationGroups = [
  {
    label: "Orchestration",
    items: [
      { title: "Deployments", to: "/deployments", icon: Rocket },
      { title: "Environments", to: "/environments", icon: TreePine },
      { title: "Runners", to: "/runners", icon: Cpu },
      { title: "Policies", to: "/policies", icon: ShieldCheck },
      { title: "Systems", to: "/systems", icon: LayoutDashboard },
      { title: "Jobs", to: "/jobs", icon: Briefcase },
    ],
  },
  {
    label: "Workflows",
    items: [
      {
        title: "Trigger",
        to: "/workflows",
        icon: Zap,
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Resources", to: "/resources", icon: Server },
      { title: "Providers", to: "/providers", icon: Plug },
      { title: "Groupings", to: "/groupings", icon: LayoutGrid },
      { title: "Relationship Rules", to: "/relationship-rules", icon: Link2 },
      { title: "Views", to: "/views", icon: Eye },
    ],
  },
];

const UserNav: React.FC<{
  viewer: { image: string | null; name: string | null; email: string };
}> = ({ viewer }) => {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate("/login");
        },
      },
    });
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage
                  src={viewer.image ?? undefined}
                  alt={viewer.name ?? undefined}
                />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{viewer.name}</span>
                <span className="truncate text-xs">{viewer.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={viewer.image ?? undefined}
                    alt={viewer.name ?? undefined}
                  />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{viewer.name}</span>
                  <span className="truncate text-xs">{viewer.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === "dark" ? (
                  <>
                    <Sun />
                    Light mode
                  </>
                ) : (
                  <>
                    <Moon />
                    Dark mode
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default function WorkspaceLayout() {
  const path = useLocation();
  const { workspaceSlug } = useParams<{ workspaceSlug?: string }>();
  const { data: viewer } = trpc.user.session.useQuery();
  const workspaces = viewer?.workspaces ?? [];

  if (path.pathname === `/${workspaceSlug}`)
    return <Navigate to={`/${workspaceSlug}/deployments`} />;

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              {viewer != null && (
                <WorkspaceSelector
                  viewer={viewer}
                  activeWorkspaceId={viewer.activeWorkspaceId}
                  workspaces={workspaces}
                />
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {navigationGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const url = `/${workspaceSlug}${item.to}`;
                    const isActive = path.pathname.startsWith(url);
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            isActive ? "" : "text-muted-foreground",
                          )}
                        >
                          <NavLink to={url} className="flex items-center gap-2">
                            <item.icon />
                            <span>{item.title}</span>
                            <span className="flex-1" />
                            {isActive && (
                              <span>
                                <ChevronRight className="size-4" />
                              </span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          {viewer != null && <UserNav viewer={viewer} />}
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
