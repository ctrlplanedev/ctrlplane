import { SystemBreadcrumbNavbar } from "../../../SystemsBreadcrumb";
import { TopNav } from "../../../TopNav";

export default function DeploymentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: any;
}) {
  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>
      {children}
    </>
  );
}
