import React from "react";
import {
  IconBook,
  IconCategory,
  IconChartBar,
  IconCube,
  IconPlug,
  IconRocket,
  IconSettings,
} from "@tabler/icons-react";

import { TopNav } from "./TopNav";
import { TopSidebarIcon } from "./TopSidebarIcon";

export const metadata = {
  title: "Ctrlplane",
};

export default async function Layout(props: {
  params: Promise<{ workspaceSlug: string }>;
  children: React.ReactNode;
}) {
  const params = await props.params;
  return (
    <div className="flex h-screen w-full flex-col">
      <TopNav workspaceSlug={params.workspaceSlug} />

      <div className="flex flex-1">
        <div className="flex bg-neutral-950">
          <aside className="flex flex-col bg-neutral-900/50 pt-2">
            <TopSidebarIcon
              icon={<IconCube />}
              label="Resources"
              href={`/${params.workspaceSlug}/resources`}
            />
            <TopSidebarIcon
              icon={<IconCategory />}
              label="Systems"
              href={`/${params.workspaceSlug}/systems2`}
            />
            <TopSidebarIcon
              icon={<IconRocket />}
              label="Deploys"
              href={`/${params.workspaceSlug}/deployments2`}
            />
            <TopSidebarIcon
              icon={<IconBook />}
              label="Runbooks"
              href={`/${params.workspaceSlug}/runbooks`}
            />
            <TopSidebarIcon
              icon={<IconChartBar />}
              label="Insights"
              href={`/${params.workspaceSlug}/insights`}
            />
            <div className="flex-grow" />
            <TopSidebarIcon
              icon={<IconPlug />}
              label="Connect"
              href={`/${params.workspaceSlug}/systems2`}
            />
            <TopSidebarIcon
              icon={<IconSettings />}
              label="Settings"
              href={`/${params.workspaceSlug}/systems2`}
            />
          </aside>
        </div>

        <div className="flex-1 rounded-tl-lg border-l border-t">
          {props.children}
        </div>
      </div>
    </div>
  );
}
