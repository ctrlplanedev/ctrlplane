import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@ctrlplane/ui/card";

import { api } from "../../../../trpc/server";
import { JobHistoryChart } from "../systems/JobHistoryChart";
import { ResourceAnnotationPieChart } from "./ResourceAnnotationPieChart";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  return {
    title: `Dashboard - ${params.workspaceSlug}`,
  };
}

export default async function Dashboard(
  props: {
    params: Promise<{ workspaceSlug: string }>;
  }
) {
  const params = await props.params;
  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug).catch(() => null);
  if (workspace == null) return notFound();
  return (
    <div className="grid grid-cols-3 gap-8 p-8">
      <JobHistoryChart className="col-span-3" workspace={workspace} />
      <ResourceAnnotationPieChart workspaceId={workspace.id} />
      <Card>test</Card>
    </div>
  );
}
