import type { RouterOutputs } from "@ctrlplane/trpc";

import type { Environment } from "./types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type VersionActionsPanelProps = {
  version: NonNullable<
    NonNullable<RouterOutputs["deployment"]["versions"]>["items"]
  >[number];
  environments: Environment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// type EnvironmentDeploymentStatus = {
//   env: Environment;
//   onVersion: number; // Number of release targets currently on this version
//   total: number; // Total release targets in environment
//   cannotDeployReasons: Array<{ reason: string; count: number }>; // Reasons why some can't deploy
// };

// const EnvironmentRow: React.FC<EnvironmentDeploymentStatus> = ({
//   env,
//   onVersion,
//   total,
//   cannotDeployReasons,
// }) => {
//   const isFullyDeployed = onVersion === total && total > 0;
//   const isPartiallyDeployed = onVersion > 0 && onVersion < total;
//   const isNotDeployed = onVersion === 0;
//   const hasBlockedResources = cannotDeployReasons.length > 0;

//   return (
//     <div className="rounded border p-2.5">
//       <div className="flex items-start justify-between">
//         <div className="flex-1">
//           <div className="mb-1 flex items-center gap-2">
//             <span className="text-sm font-medium">{env.name}</span>
//             {isFullyDeployed && (
//               <Badge className="border-green-500/20 bg-green-500/10 py-0 text-[10px] text-green-600">
//                 <CheckCircle className="mr-0.5 h-2.5 w-2.5" />
//                 Fully Deployed
//               </Badge>
//             )}
//           </div>

//           <div className="mb-2 flex items-baseline gap-1.5">
//             <span className="text-lg font-semibold">
//               {onVersion}
//               <span className="text-muted-foreground">/{total}</span>
//             </span>
//             <span className="text-xs text-muted-foreground">
//               resource{total !== 1 ? "s" : ""} on this version
//             </span>
//           </div>

//           {/* Status Messages */}
//           <div className="space-y-1">
//             {isFullyDeployed && (
//               <div className="flex items-center gap-1.5 text-xs text-green-600">
//                 <Check className="h-3 w-3" />
//                 All resources deployed successfully
//               </div>
//             )}

//             {isPartiallyDeployed && !hasBlockedResources && (
//               <div className="flex items-center gap-1.5 text-xs text-blue-600">
//                 <AlertCircle className="h-3 w-3" />
//                 Can deploy to {total - onVersion} more resource
//                 {total - onVersion !== 1 ? "s" : ""}
//               </div>
//             )}

//             {isNotDeployed && !hasBlockedResources && (
//               <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
//                 <AlertCircle className="h-3 w-3" />
//                 Not yet deployed to this environment
//               </div>
//             )}

//             {hasBlockedResources && (
//               <div className="space-y-1">
//                 {cannotDeployReasons.map((reason, idx) => (
//                   <Tooltip key={idx}>
//                     <TooltipTrigger asChild>
//                       <div className="flex items-center gap-1.5 text-xs text-amber-600">
//                         <Shield className="h-3 w-3" />
//                         <span>
//                           {reason.count} resource{reason.count !== 1 ? "s" : ""}{" "}
//                           blocked: {reason.reason}
//                         </span>
//                       </div>
//                     </TooltipTrigger>
//                     <TooltipContent side="left" className="max-w-sm">
//                       <div className="text-[11px]">
//                         {reason.reason} - preventing deployment to{" "}
//                         {reason.count} resource{reason.count !== 1 ? "s" : ""}
//                       </div>
//                     </TooltipContent>
//                   </Tooltip>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Status Icon */}
//         <div className="ml-2 flex items-center">
//           {isFullyDeployed ? (
//             <CheckCircle className="h-5 w-5 text-green-600" />
//           ) : hasBlockedResources && onVersion === 0 ? (
//             <XCircle className="h-5 w-5 text-amber-600" />
//           ) : (
//             <AlertCircle className="h-5 w-5 text-blue-600" />
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

export const VersionActionsPanel: React.FC<VersionActionsPanelProps> = ({
  version,
  open,
  onOpenChange,
}) => {
  // // Calculate deployment status for each environment
  // const environmentStatuses: EnvironmentDeploymentStatus[] = environments.map(
  //   (env) => {
  //     const envReleaseTargets = releaseTargets.filter(
  //       (rt) => rt.environment.id === env.id,
  //     );
  //     const total = envReleaseTargets.length;

  //     // Count how many are currently on this version
  //     const onVersion = envReleaseTargets.filter(
  //       (rt) => rt.state.currentRelease.version.id === version.id,
  //     ).length;

  //     // Find resources that cannot deploy this version and why
  //     const blockReasonsMap = new Map<string, number>();
  //     // envReleaseTargets.forEach((rt) => {
  //     //   const blockForVersion = rt.state.desiredRelease.blockedVersions?.find(
  //     //     (bv) => bv.versionId === version.id,
  //     //   );
  //     //   if (blockForVersion) {
  //     //     const currentCount = blockReasonsMap.get(blockForVersion.reason) ?? 0;
  //     //     blockReasonsMap.set(blockForVersion.reason, currentCount + 1);
  //     //   }
  //     // });

  //     const cannotDeployReasons = Array.from(blockReasonsMap.entries()).map(
  //       ([reason, count]) => ({
  //         reason,
  //         count,
  //       }),
  //     );

  //     return {
  //       env,
  //       onVersion,
  //       total,
  //       cannotDeployReasons,
  //     };
  //   },
  // );

  // // Calculate summary stats
  // const totalResources = environmentStatuses.reduce(
  //   (sum, e) => sum + e.total,
  //   0,
  // );
  // const totalOnVersion = environmentStatuses.reduce(
  //   (sum, e) => sum + e.onVersion,
  //   0,
  // );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="font-mono text-base">
            {version.tag}
          </DialogTitle>
          <DialogDescription className="text-[10px]">
            {/* Deployed to {totalOnVersion} of {totalResources} total resources
            across all environments */}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-4 pb-4">
          <div className="space-y-2.5 pt-4">
            {/* {environmentStatuses.map((status) => (
              <EnvironmentRow key={status.env.id} {...status} />
            ))} */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
