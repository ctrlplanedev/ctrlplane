import { SidebarProvider } from "@ctrlplane/ui/sidebar";

import { TerminalSessionsProvider } from "~/app/terminal/TerminalSessionsProvider";
import { Sidebars } from "./sidebars";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider sidebarNames={[Sidebars.Workspace]}>
      <TerminalSessionsProvider>{children}</TerminalSessionsProvider>
    </SidebarProvider>
  );
}
