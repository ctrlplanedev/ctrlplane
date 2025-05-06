"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  IconChevronDown,
  IconPlant,
  IconShip,
  IconTopologyComplex,
} from "@tabler/icons-react";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

const ChevronIcon: React.FC<{ expandable?: boolean }> = ({ expandable }) =>
  expandable ? (
    <IconChevronDown
      className={
        "h-3 w-3 shrink-0 text-accent-foreground/50 transition-transform duration-200"
      }
    />
  ) : (
    <div className="h-3 w-3"></div>
  );

const SystemDeployments: React.FC<{
  workspaceSlug: string;
  systemId: string;
  systemSlug: string;
}> = ({ workspaceSlug, systemId, systemSlug }) => {
  const { data: deployments } = api.deployment.bySystemId.useQuery(systemId, {
    placeholderData: (prev) => prev,
  });
  return (
    <AccordionPrimitive.Item value="deployments">
      <AccordionPrimitive.Trigger className="flex w-full flex-1 items-center gap-2 rounded-md px-2 py-2 pl-6 transition-all hover:bg-accent/50 first:[&[data-state=open]>svg]:rotate-90">
        <ChevronIcon expandable />
        <IconShip className="h-4 w-4 text-blue-400" />
        <span>Deployments</span>
        <div className="flex-grow" />
        <div className="rounded-full border  border-blue-500/50 bg-blue-500/10 px-2 py-0 text-xs text-blue-400">
          {deployments?.length ?? "-"}
        </div>
      </AccordionPrimitive.Trigger>
      <AccordionPrimitive.Content>
        {deployments?.map((d) => (
          <Link
            key={d.id}
            href={urls
              .workspace(workspaceSlug)
              .system(systemSlug)
              .deployment(d.slug)
              .baseUrl()}
            className="flex w-full flex-1 items-center gap-2 rounded-md px-2 py-2 pl-12 hover:bg-accent/50"
          >
            {d.name}
          </Link>
        ))}
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
};

const SystemEnvironments: React.FC<{
  workspaceSlug: string;
  systemId: string;
  systemSlug: string;
}> = ({ workspaceSlug, systemId, systemSlug }) => {
  const { data: environments } = api.environment.bySystemId.useQuery(systemId, {
    placeholderData: (prev) => prev,
  });

  return (
    <AccordionPrimitive.Item value="environments">
      <AccordionPrimitive.Trigger className="flex w-full flex-1 items-center gap-2 rounded-md px-2 py-2 pl-6 transition-all hover:bg-accent/50 first:[&[data-state=open]>svg]:rotate-90">
        <ChevronIcon expandable />
        <IconPlant className="h-4 w-4 text-green-400" />
        <span>Environments</span>
        <div className="flex-grow" />
        <div className="rounded-full border  border-green-500/50 bg-green-500/10 px-2 py-0 text-xs text-green-400">
          {environments?.length ?? "-"}
        </div>
      </AccordionPrimitive.Trigger>
      <AccordionPrimitive.Content>
        {environments?.map((e) => (
          <Link
            key={e.id}
            href={urls
              .workspace(workspaceSlug)
              .system(systemSlug)
              .environment(e.id)
              .baseUrl()}
            className="flex w-full flex-1 items-center gap-2 rounded-md px-2 py-2 pl-12 hover:bg-accent/50"
          >
            {e.name}
          </Link>
        ))}
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
};

export const SystemTreePageContent: React.FC<{
  workspace: SCHEMA.Workspace;
}> = ({ workspace }) => {
  const workspaceId = workspace.id;
  const { data } = api.system.list.useQuery(
    { workspaceId, query: undefined },
    { placeholderData: (prev) => prev },
  );

  const systems = data?.items ?? [];

  return (
    <div className="text-sm">
      <AccordionPrimitive.Root type="multiple">
        {systems.map((s) => (
          <AccordionPrimitive.Item key={s.id} value={s.id}>
            <AccordionPrimitive.Trigger className="flex w-full flex-1 items-center gap-2 rounded-md px-2 py-2 transition-all hover:bg-accent/50 first:[&[data-state=open]>svg]:rotate-90">
              <ChevronIcon expandable />
              <IconTopologyComplex className="h-4 w-4" />
              <span>{s.name}</span>
            </AccordionPrimitive.Trigger>
            <AccordionPrimitive.Content>
              <AccordionPrimitive.Root type="multiple">
                <SystemDeployments
                  workspaceSlug={workspace.slug}
                  systemId={s.id}
                  systemSlug={s.slug}
                />
                <SystemEnvironments
                  workspaceSlug={workspace.slug}
                  systemId={s.id}
                  systemSlug={s.slug}
                />
              </AccordionPrimitive.Root>
            </AccordionPrimitive.Content>
          </AccordionPrimitive.Item>
        ))}
      </AccordionPrimitive.Root>
    </div>
  );
};
