import type * as schema from "@ctrlplane/db/schema";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { RelationshipsDiagramProvider } from "./RelationshipsDiagram";

type PageProps = {
  params: Promise<{ workspaceSlug: string; resourceId: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { workspaceSlug, resourceId } = await props.params;
  const [workspace, resource] = await Promise.all([
    api.workspace.bySlug(workspaceSlug),
    api.resource.byId(resourceId),
  ]);

  if (workspace == null || resource == null) return notFound();

  return {
    title: `Visualize | ${resource.name} | ${workspace.name}`,
  };
}

export default async function RelationshipsPage(props: PageProps) {
  const { resourceId } = await props.params;
  const { resource, ...relationships } =
    await api.resource.relationships(resourceId);

  const parents = Object.values(relationships.parents).map((p) => ({
    ...p,
    type: p.type as schema.ResourceDependencyType,
  }));

  const children = relationships.children.map((c) => ({
    ...c,
    type: c.type as schema.ResourceDependencyType,
  }));

  return (
    <RelationshipsDiagramProvider
      resource={resource}
      parents={parents}
      children={children}
    />
  );
}
