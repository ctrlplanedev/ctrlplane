import { toast } from "sonner";

import { trpc } from "~/api/trpc";

export function useDomainMatchingRules(workspaceId: string) {
  const { data: rules } = trpc.workspace.domainMatchingList.useQuery({
    workspaceId,
  });
  const { data: roles } = trpc.workspace.roles.useQuery({ workspaceId });

  return { rules, roles };
}

export function useCreateDomainMatchingRule(workspaceId: string) {
  const utils = trpc.useUtils();

  return trpc.workspace.domainMatchingCreate.useMutation({
    onSuccess: () => {
      toast.success("Domain matching rule added");
      utils.workspace.domainMatchingList.invalidate({ workspaceId });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteDomainMatchingRule(workspaceId: string) {
  const utils = trpc.useUtils();

  return trpc.workspace.domainMatchingDelete.useMutation({
    onSuccess: () => {
      toast.success("Domain matching rule removed");
      utils.workspace.domainMatchingList.invalidate({ workspaceId });
    },
    onError: (err) => toast.error(err.message),
  });
}
