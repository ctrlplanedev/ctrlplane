import React from "react";
import {
  IconCube,
  IconDashboard,
  IconRocket,
  IconSettings,
  IconShieldCheck,
} from "@tabler/icons-react";

import { urls } from "~/app/urls";
import { VariableSetDrawer } from "./_components/variable-set/VariableSetDrawer";
import { TopNav } from "./TopNav";
import { TopSidebarIcon } from "./TopSidebarIcon";

export const metadata = { title: "Ctrlplane" };

export default async function Layout(props: {
  params: Promise<{ workspaceSlug: string }>;
  children: React.ReactNode;
}) {
  const params = await props.params;
  const workspaceUrls = urls.workspace(params.workspaceSlug);
  return (
    <>
      <div className="flex h-screen w-full flex-col bg-[#111111]">
        <TopNav workspaceSlug={params.workspaceSlug} />

        <div className="flex h-full flex-1">
          <aside className="flex flex-col bg-[#111111] pt-2">
            <TopSidebarIcon
              icon={<IconRocket />}
              label="Deploys"
              href={workspaceUrls.systems()}
            />

            <TopSidebarIcon
              icon={<IconCube />}
              label="Inventory"
              href={workspaceUrls.resources().baseUrl()}
            />
            <TopSidebarIcon
              icon={<IconShieldCheck />}
              label="Policies"
              href={workspaceUrls.policies().baseUrl()}
            />
            <TopSidebarIcon
              icon={<IconDashboard />}
              label="Dashboards"
              href={workspaceUrls.dashboards()}
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
              href={workspaceUrls.workspaceSettings().baseUrl()}
            />
          </aside>

          <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-57px)] flex-1 overflow-auto rounded-tl-lg border-l border-t bg-neutral-950">
            {props.children}
          </div>
        </div>
      </div>

      <VariableSetDrawer />
    </>
  );
}
