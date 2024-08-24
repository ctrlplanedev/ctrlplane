import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@ctrlplane/ui/card";

import { api } from "../../../trpc/server";
import { JobExecHistoryChart } from "./JobExecHistoryChart";
import { TargetAnnotationPieChart } from "./TargetAnnotationPieChart";

type PageProps = {
  params: { workspaceSlug: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: `Dashboard - ${params.workspaceSlug}`,
  };
}

export default async function Dashboard({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug).catch(() => null);
  if (workspace == null) return notFound();
  return (
    <div className="grid grid-cols-3 gap-8 p-8">
      <JobExecHistoryChart className="col-span-3" />
      <TargetAnnotationPieChart workspaceId={workspace.id} />
      <Card>test</Card>
    </div>
  );
}
