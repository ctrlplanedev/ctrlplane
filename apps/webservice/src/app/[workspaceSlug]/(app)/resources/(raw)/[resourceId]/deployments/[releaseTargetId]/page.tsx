import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ReleaseTargetVersionsTable } from "./ReleaseTargetVersionsTable";

type PageProps = {
  params: Promise<{
    releaseTargetId: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { releaseTargetId } = await params;
  const releaseTarget = await api.releaseTarget.byId(releaseTargetId);
  if (releaseTarget == null) notFound();

  return <ReleaseTargetVersionsTable releaseTarget={releaseTarget} />;
}
