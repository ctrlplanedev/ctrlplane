import { api } from "~/trpc/server";

export default async function RunbookPage({
  params: { runbookId },
}: {
  params: { runbookId: string };
}) {
  const runbookJobs = await api.runbook.jobs({ runbookId, limit: 0 });
  return null;
}
