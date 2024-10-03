import type * as schema from "@ctrlplane/db/schema";
import { IconFilter } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";
import { DistroBarChart } from "./DistroBarChart";

// const ReleaseTable: React.FC<{
//   deployment: schema.Deployment;
// }> = ({ deployment }) => {
//   const releases = api.release.list.useQuery({})

//   return <div>ReleaseTable</div>;
// };

type DeploymentPageContentProps = {
  deployment: schema.Deployment;
};

export const DeploymentPageContent: React.FC<DeploymentPageContentProps> = ({
  deployment,
}) => {
  const showPreviousReleaseDistro = 30;

  return (
    <div>
      <div className="grid grid-cols-12 border-b">
        <div className="col-span-8 flex flex-1 flex-col justify-center px-6 py-5 sm:py-6">
          <span className="font-semibold">Releases</span>
          <span className="text-muted-foreground">Your releases</span>
        </div>
        <div className="col-span-4 border-l">Statistics</div>
      </div>
      <div className="border-b">
        <DistroBarChart
          deploymentId={deployment.id}
          showPreviousReleaseDistro={showPreviousReleaseDistro}
        />
      </div>
      <div className="h-full text-sm">
        <div className="flex items-center justify-between border-b border-neutral-800 p-1 px-2">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
            >
              <IconFilter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
