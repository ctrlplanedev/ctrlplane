import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { PageContent } from "./PageContent";

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
  const resource = await api.resource.byId(resourceId);
  if (resource == null) return notFound();

  return <PageContent focusedResource={resource} />;
}
