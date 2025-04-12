import { redirect } from "next/navigation";

import { urls } from "~/app/urls";

export default async function PolicyPage(props: {
  params: Promise<{ workspaceSlug: string; policyId: string }>;
}) {
  const { workspaceSlug, policyId } = await props.params;
  return redirect(
    urls.workspace(workspaceSlug).policies().edit(policyId).baseUrl(),
  );
}
