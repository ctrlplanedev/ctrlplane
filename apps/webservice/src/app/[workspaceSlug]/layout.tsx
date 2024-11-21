import { SidebarProvider } from "@ctrlplane/ui/sidebar";

import { TerminalSessionsProvider } from "./(app)/_components/terminal/TerminalSessionsProvider";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <TerminalSessionsProvider>{children}</TerminalSessionsProvider>
    </SidebarProvider>
  );
}
