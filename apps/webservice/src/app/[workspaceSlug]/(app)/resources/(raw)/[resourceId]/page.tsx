import { notFound, redirect } from "next/navigation";

import { api } from "~/trpc/server";

type Params = Promise<{ resourceId: string; workspaceSlug: string }>;

export default async function ResourcePage(props: { params: Params }) {
  const params = await props.params;
  const { resourceId, workspaceSlug } = params;

  const resource = await api.resource.byId(resourceId);
  if (resource == null) notFound();

  return redirect(`/${workspaceSlug}/resources/${resourceId}/deployments`);
}
