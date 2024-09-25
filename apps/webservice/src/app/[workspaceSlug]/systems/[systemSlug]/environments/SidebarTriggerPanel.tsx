import { IconBolt } from "@tabler/icons-react";

import { Separator } from "@ctrlplane/ui/separator";

export const SidebarTriggerPanel: React.FC = () => {
  return (
    <div>
      <h2 className="flex items-center gap-4 p-6 text-2xl font-semibold">
        <div className="flex-shrink-0 rounded bg-blue-500/20 p-1 text-blue-400">
          <IconBolt className="h-4 w-4" />
        </div>
        <span className="flex-grow">Trigger</span>
      </h2>
      <Separator />
      <div className="m-6 space-y-3">
        <p>
          This block repersents the starting point of the environment release
          flow. When a new release is created it starts here.
        </p>
        <p>Create policies to add restrictions.</p>
      </div>
    </div>
  );
};
