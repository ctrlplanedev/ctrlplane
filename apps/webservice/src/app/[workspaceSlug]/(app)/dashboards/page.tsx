import Link from "next/link";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { CreateDashboardButton } from "./CreateDashboardButton";

export default async function DasboardsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace
    .bySlug(params.workspaceSlug)
    .catch(() => null);
  if (workspace == null) return notFound();
  const dashboards = await api.dashboard.byWorkspaceId(workspace.id);
  return (
    <div className="flex flex-col gap-4">
      <CreateDashboardButton workspace={workspace} />
      {dashboards.map((d) => (
        <Link key={d.id} href={`/${workspace.slug}/dashboards/${d.id}`}>
          {d.name}
        </Link>
      ))}
    </div>
  );
}
