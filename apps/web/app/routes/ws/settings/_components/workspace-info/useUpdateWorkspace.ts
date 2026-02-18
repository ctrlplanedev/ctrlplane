import { toast } from "sonner";

import { trpc } from "~/api/trpc";

export function useUpdateWorkspace() {
  return trpc.workspace.update.useMutation({
    onSuccess: () => toast.success("Workspace updated successfully"),
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to update workspace";
      toast.error(message);
    },
  });
}
