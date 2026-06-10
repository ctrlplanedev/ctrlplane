import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { ExpirySelect } from "../../release-targets/ExpirySelect";
import { expiryOptionsForRule } from "../../release-targets/skip-expiry";
import { getRuleDisplay } from "./utils";

type CreateSkipFormProps = {
  rules: WorkspaceEngine["schemas"]["PolicyRule"][];
  environmentId: string;
  versionId: string;
};

export function CreateSkipForm({
  rules,
  environmentId,
  versionId,
}: CreateSkipFormProps) {
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();
  const [now] = useState(() => new Date());
  const [ruleId, setRuleId] = useState<string | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const { data: evaluations = [] } = trpc.deploymentVersions.evaulate.useQuery(
    { versionId, environmentId },
    { enabled: ruleId != null },
  );
  const options = expiryOptionsForRule(evaluations, ruleId, now);
  const selected = options.find((o) => o.id === selectedId) ?? options[0];
  const expiresAt = selected?.value ?? undefined;

  const selectedRule = rules.find((rule) => rule.id === ruleId);
  const createSkip = trpc.policySkips.createForEnvAndVersion.useMutation({
    onSuccess: () => {
      toast.success("Skip added");
      setRuleId(undefined);
      setSelectedId(undefined);
      utils.policySkips.forEnvAndVersion.invalidate({ environmentId, versionId });
    },
  });

  const onAdd = () => {
    if (ruleId == null) return;
    createSkip.mutate({
      workspaceId: workspace.id,
      environmentId,
      versionId,
      ruleId,
      expiresAt,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Add new skip</h3>
      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <span className="text-xs font-medium">Rule</span>
          <Select
            value={ruleId}
            onValueChange={(id) => {
              setRuleId(id);
              setSelectedId(undefined);
            }}
          >
            <SelectTrigger className="w-full">
              {selectedRule ? getRuleDisplay(selectedRule) : "Select a rule"}
            </SelectTrigger>
            <SelectContent align="start">
              {rules.map((rule) => (
                <SelectItem key={rule.id} value={rule.id}>
                  {getRuleDisplay(rule)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ExpirySelect
          options={options}
          selectedId={selected?.id}
          onChange={setSelectedId}
        />
        <Button
          type="button"
          size="sm"
          className="w-fit"
          disabled={ruleId == null || createSkip.isPending}
          onClick={onAdd}
        >
          Add skip
        </Button>
      </div>
    </div>
  );
}
