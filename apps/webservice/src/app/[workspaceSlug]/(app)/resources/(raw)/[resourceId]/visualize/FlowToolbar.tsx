import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconFilter,
  IconFocusCentered,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { useCollapsibleTree } from "./CollapsibleTreeContext";

const CenterButton: React.FC = () => {
  const { flowToolbar } = useCollapsibleTree();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={flowToolbar.fitView}
            className="bg-neutral-900"
          >
            <IconFocusCentered className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Center graph on screen</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ExpandAllButton: React.FC = () => {
  const { flowToolbar } = useCollapsibleTree();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={flowToolbar.expandAll}
            className="bg-neutral-900"
          >
            <IconArrowsMaximize className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Expand all</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const CollapseAllButton: React.FC = () => {
  const { flowToolbar } = useCollapsibleTree();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={flowToolbar.collapseAll}
            className="bg-neutral-900"
          >
            <IconArrowsMinimize className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Collapse all</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const CompactViewButton: React.FC = () => {
  const { flowToolbar } = useCollapsibleTree();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={flowToolbar.getCompactView}
            className="bg-neutral-900"
          >
            <IconFilter className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Compact view</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const FlowToolbar: React.FC = () => (
  <div className="absolute bottom-4 right-1/2 flex items-center gap-2 rounded-md bg-neutral-900 p-2">
    <CenterButton />
    <Separator orientation="vertical" className="h-6 bg-neutral-800" />
    <ExpandAllButton />
    <Separator orientation="vertical" className="h-6 bg-neutral-800" />
    <CollapseAllButton />
    <Separator orientation="vertical" className="h-6 bg-neutral-800" />
    <CompactViewButton />
  </div>
);
