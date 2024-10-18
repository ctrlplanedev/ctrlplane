import type * as SCHEMA from "@ctrlplane/db/schema";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import type React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SiKubernetes, SiTerraform } from "@icons-pack/react-simple-icons";
import { IconExternalLink, IconServer, IconTarget } from "@tabler/icons-react";
import LZString from "lz-string";
import { isPresent } from "ts-is-present";

import { Button } from "@ctrlplane/ui/button";
import { Label } from "@ctrlplane/ui/label";
import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import { api } from "~/trpc/react";
import { TargetConditionDialog } from "../target-condition/TargetConditionDialog";

const TargetIcon: React.FC<{ version: string }> = ({ version }) => {
  if (version.includes("kubernetes"))
    return <SiKubernetes className="h-6 w-6 shrink-0 text-blue-300" />;
  if (version.includes("vm") || version.includes("compute"))
    return <IconServer className="h-6 w-6 shrink-0 text-cyan-300" />;
  if (version.includes("terraform"))
    return <SiTerraform className="h-6 w-6 shrink-0 text-purple-300" />;
  return <IconTarget className="h-6 w-6 shrink-0 text-neutral-300" />;
};

export const TargetContent: React.FC<{
  variableSet: SCHEMA.VariableSet;
  system: SCHEMA.System & { environments: SCHEMA.Environment[] };
}> = ({ variableSet, system }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const update = api.variableSet.update.useMutation();

  const router = useRouter();
  const utils = api.useUtils();

  const envFilters = system.environments
    .map((env) => env.targetFilter)
    .filter(isPresent);
  const systemFilter: TargetCondition = {
    type: TargetFilterType.Comparison,
    operator: TargetOperator.Or,
    not: false,
    conditions: envFilters,
  };

  const filter: TargetCondition = {
    type: TargetFilterType.Comparison,
    operator: TargetOperator.And,
    not: false,
    conditions: [systemFilter, variableSet.targetFilter],
  };

  const targetQ = api.target.byWorkspaceId.list.useQuery({
    workspaceId: system.workspaceId,
    filter,
    limit: 5,
  });

  const targets = targetQ.data?.items ?? [];
  const total = targetQ.data?.total ?? 0;

  const onChange = (targetFilter?: TargetCondition) => {
    if (targetFilter == null) return;
    update
      .mutateAsync({ id: variableSet.id, data: { targetFilter } })
      .then(() => utils.variableSet.byId.invalidate(variableSet.id))
      .then(() => router.refresh());
  };

  return (
    <div className="space-y-4 p-6">
      <Label>Targets ({total})</Label>

      <div className="space-y-2">
        {targets.map((target) => (
          <div className="flex items-center gap-2" key={target.id}>
            <TargetIcon version={target.version} />
            <div className="flex flex-col">
              <span className="overflow-hidden text-nowrap text-sm">
                {target.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {target.version}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <TargetConditionDialog
          onChange={onChange}
          condition={variableSet.targetFilter}
        >
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <IconTarget className="h-4 w-4" />
            Set Targets
          </Button>
        </TargetConditionDialog>
        <Link
          href={`/${workspaceSlug}/targets?${new URLSearchParams({
            filter: LZString.compressToEncodedURIComponent(
              JSON.stringify(filter),
            ),
          })}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <IconExternalLink className="h-4 w-4" />
            View Targets
          </Button>
        </Link>
      </div>
    </div>
  );
};
