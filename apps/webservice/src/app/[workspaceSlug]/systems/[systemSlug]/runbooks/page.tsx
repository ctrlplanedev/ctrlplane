import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TbDotsVertical } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../SystemsBreadcrumb";
import { TopNav } from "../../TopNav";
import { RunbookGettingStarted } from "./RunbookGettingStarted";

export const metadata: Metadata = { title: "Runbooks - Systems" };

export default async function Runbooks({ params }: { params: any }) {
  const system = await api.system.bySlug(params).catch(notFound);
  const runbooks = await api.runbook.bySystemId(system.id);
  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>

      {runbooks.length === 0 ? (
        <RunbookGettingStarted {...params} />
      ) : (
        <>
          {runbooks.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between border-b p-4"
            >
              <div>
                <h3 className="font-semibold">{r.name}</h3>
                <p className="text-sm text-muted-foreground">{r.description}</p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <TbDotsVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Trigger Runbook</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </>
      )}
    </>
  );
}
