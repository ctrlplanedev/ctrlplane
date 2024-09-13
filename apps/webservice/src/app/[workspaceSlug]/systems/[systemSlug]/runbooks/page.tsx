import type { Metadata } from "next";

import { SystemBreadcrumbNavbar } from "../../SystemsBreadcrumb";
import { TopNav } from "../../TopNav";
import { RunbookGettingStarted } from "./RunbookGettingStarted";

export const metadata: Metadata = { title: "Runbooks - Systems" };

export default function Runbooks({ params }: { params: any }) {
  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>
      <RunbookGettingStarted {...params} />
    </>
  );
}
