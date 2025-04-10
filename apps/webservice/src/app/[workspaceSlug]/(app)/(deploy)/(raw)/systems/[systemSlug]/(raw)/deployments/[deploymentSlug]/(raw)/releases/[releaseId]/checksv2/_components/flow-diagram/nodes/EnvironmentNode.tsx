import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import { IconPlant } from "@tabler/icons-react";
import { Handle, Position } from "reactflow";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";
import { Separator } from "@ctrlplane/ui/separator";

import { ApprovalCheck } from "../checks/Approval";
import { DenyWindowCheck } from "../checks/DenyWindow";

type EnvironmentNodeProps = NodeProps<{
  workspaceId: string;
  policy?: SCHEMA.EnvironmentPolicy;
  versionId: string;
  versionTag: string;
  deploymentId: string;
  environmentId: string;
  environmentName: string;
}>;

export const EnvironmentNode: React.FC<EnvironmentNodeProps> = ({ data }) => (
  <>
    <div
      className={cn("relative w-[350px] space-y-1 rounded-md border text-sm")}
    >
      <div className="flex items-center gap-2 p-2">
        <div className="flex-shrink-0 rounded bg-green-500/20 p-1 text-green-400">
          <IconPlant className="h-3 w-3" />
        </div>
        {data.environmentName}
      </div>
      <Separator className="!m-0 bg-neutral-800" />
      <div className="space-y-1 px-2 pb-2">
        <ApprovalCheck {...data} />
        <DenyWindowCheck {...data} />
      </div>
    </div>
    <Handle
      type="target"
      className="h-2 w-2 rounded-full border border-neutral-500"
      style={{ background: colors.neutral[800] }}
      position={Position.Left}
    />
    <Handle
      type="source"
      className="h-2 w-2 rounded-full border border-neutral-500"
      style={{ background: colors.neutral[800] }}
      position={Position.Right}
    />
  </>
);
