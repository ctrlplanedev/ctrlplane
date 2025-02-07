import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <SidebarProvider>
        <Sidebar className="absolute left-0 top-0 -z-10">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Resources</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuButton>List</SidebarMenuButton>
                <SidebarMenuButton>Providers</SidebarMenuButton>
                <SidebarMenuButton>Resources</SidebarMenuButton>
                <SidebarMenuButton>Views</SidebarMenuButton>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Common Types</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuButton>List</SidebarMenuButton>
                <SidebarMenuButton>Providers</SidebarMenuButton>
                <SidebarMenuButton>Resources</SidebarMenuButton>
                <SidebarMenuButton>Views</SidebarMenuButton>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Recently Added</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuButton>List</SidebarMenuButton>
                <SidebarMenuButton>Providers</SidebarMenuButton>
                <SidebarMenuButton>Resources</SidebarMenuButton>
                <SidebarMenuButton>Views</SidebarMenuButton>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>test</SidebarFooter>
        </Sidebar>
        <main className="h-[calc(100vh-56px-1px)]">{children}</main>
      </SidebarProvider>
    </div>
  );
}
