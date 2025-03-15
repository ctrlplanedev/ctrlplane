import type { RouterOutputs } from "@ctrlplane/api";
import { IconFilter } from "@tabler/icons-react";

type UsageInfo = NonNullable<
  RouterOutputs["deployment"]["releaseChannel"]["byId"]
>["usage"];

export const Usage: React.FC<{ usage: UsageInfo }> = ({ usage }) => {
  const { policies } = usage;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex-shrink-0 rounded bg-purple-500/20 p-1 text-purple-400">
            <IconFilter className="h-3 w-3" />
          </div>
          Policies
        </div>
        <div className="flex flex-col items-start gap-1">
          {policies.map((p) => (
            <div key={p.id} className="h-fit p-0 text-sm text-neutral-300">
              {p.name != "" ? p.name : "Unnamed policy"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
