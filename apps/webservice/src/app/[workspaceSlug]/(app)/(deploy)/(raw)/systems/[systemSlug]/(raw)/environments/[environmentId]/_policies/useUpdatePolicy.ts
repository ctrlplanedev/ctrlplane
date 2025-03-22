import type * as SCHEMA from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";

export const useUpdatePolicy = (policyId: string) => {
  const { mutateAsync, isPending } =
    api.environment.policy.update.useMutation();
  const router = useRouter();

  const onUpdate = (data: SCHEMA.UpdateEnvironmentPolicy) =>
    mutateAsync({ id: policyId, data }).then(() => router.refresh());

  return { onUpdate, isPending };
};
