"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { ReactFlowProvider } from "reactflow";

import { api } from "~/trpc/react";
import { CollapsibleTreeProvider } from "./CollapsibleTreeContext";
import { RelationshipsDiagram } from "./RelationshipsDiagram";

export const PageContent: React.FC<{
  focusedResource: schema.Resource;
}> = ({ focusedResource }) => {
  const { data, isLoading } = api.resource.visualize.useQuery(
    focusedResource.id,
  );

  const { resources, edges } = data ?? { resources: [], edges: [] };

  if (isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin" />
      </div>
    );

  return (
    <ReactFlowProvider>
      <CollapsibleTreeProvider
        focusedResource={focusedResource}
        resources={resources}
        edges={edges}
      >
        <RelationshipsDiagram />
      </CollapsibleTreeProvider>
    </ReactFlowProvider>
  );
};
