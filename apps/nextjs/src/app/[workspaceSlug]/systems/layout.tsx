import { SystemBreadcrumbNavbar } from "./SystemsBreadcrumb";
import { TopNav } from "./TopNav";

export default function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar />
      </TopNav>
      {children}
    </>
  );
}
