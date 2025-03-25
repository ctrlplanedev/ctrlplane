import { redirect } from "next/navigation";

export default function PoliciesPage(props: {
  params: {
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  };
}) {
  return redirect(
    `/${props.params.workspaceSlug}/systems/${props.params.systemSlug}/environments/${props.params.environmentId}/policies/approval`,
  );
}
