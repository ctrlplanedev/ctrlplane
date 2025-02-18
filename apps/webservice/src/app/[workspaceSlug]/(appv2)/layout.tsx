import React from "react";
import {
  IconCategory,
  IconChartBar,
  IconCube,
  IconRocket,
  IconSettings,
} from "@tabler/icons-react";

import { EnvironmentDrawer } from "../(app)/_components/environment-drawer/EnvironmentDrawer";
import { EnvironmentPolicyDrawer } from "../(app)/_components/environment-policy-drawer/EnvironmentPolicyDrawer";
import { VariableSetDrawer } from "../(app)/_components/variable-set-drawer/VariableSetDrawer";
import { ReleaseChannelDrawer } from "./_components/channel/drawer/ReleaseChannelDrawer";
import { TopNav } from "./TopNav";
import { TopSidebarIcon } from "./TopSidebarIcon";

export const metadata = { title: "Ctrlplane" };

export default async function Layout(props: {
  params: Promise<{ workspaceSlug: string }>;
  children: React.ReactNode;
}) {
  const params = await props.params;
  return (
    <>
      <div className="flex h-screen w-full flex-col bg-[#111111]">
        <TopNav workspaceSlug={params.workspaceSlug} />

        <div className="flex h-full flex-1">
          <aside className="flex flex-col bg-[#111111] pt-2">
            <TopSidebarIcon
              icon={<IconRocket />}
              label="Deploys"
              href={`/${params.workspaceSlug}/deployments`}
            />
            <TopSidebarIcon
              icon={<IconCube />}
              label="Resources"
              href={`/${params.workspaceSlug}/resources`}
            />
            <TopSidebarIcon
              icon={<IconCategory />}
              label="Systems"
              href={`/${params.workspaceSlug}/systems`}
            />
            {/* <TopSidebarIcon
            icon={<IconBook />}
            label="Runbooks"
            href={`/${params.workspaceSlug}/runbooks`}
          /> */}
            <TopSidebarIcon
              icon={<IconChartBar />}
              label="Insights"
              href={`/${params.workspaceSlug}/insights`}
            />
            <div className="flex-grow" />
            {/* <TopSidebarIcon
            icon={<IconPlug />}
            label="Connect"
            href={`/${params.workspaceSlug}/integrations`}
          /> */}
            <TopSidebarIcon
              icon={<IconSettings />}
              label="Settings"
              href={`/${params.workspaceSlug}/settings`}
            />
          </aside>

          <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-full flex-1 overflow-auto rounded-tl-lg border-l border-t bg-neutral-950">
            {props.children}
          </div>
        </div>
      </div>

      <EnvironmentDrawer />
      <EnvironmentPolicyDrawer />
      <VariableSetDrawer />
      <ReleaseChannelDrawer />
    </>
  );
}
