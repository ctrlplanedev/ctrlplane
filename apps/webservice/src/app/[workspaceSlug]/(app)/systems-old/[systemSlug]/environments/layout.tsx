import { SystemBreadcrumbNavbar } from "../../SystemsBreadcrumb";
import { TopNav } from "../../TopNav";

export default async function EnvironmentLayout(props: {
  children: React.ReactNode;
  params: Promise<any>;
}) {
  const params = await props.params;

  const { children } = props;

  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>
      {children}
    </>
  );
}
