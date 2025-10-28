import type { ReactNode } from "react";
import { MoreVertical, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

type SystemCardProps = {
  children: ReactNode;
};

function SystemCard({ children }: SystemCardProps) {
  return (
    <Card className="group transition-all hover:border-primary/50 hover:shadow-lg">
      {children}
    </Card>
  );
}

function SystemCardContent({ children }: { children: ReactNode }) {
  return <CardContent className="relative">{children}</CardContent>;
}

type SystemCardHeaderProps = {
  name: string;
  description?: string;
  onDelete?: () => void;
  isDefaultSystem?: boolean;
};

function SystemCardHeader({
  name,
  description,
  onDelete,
  isDefaultSystem = false,
}: SystemCardHeaderProps) {
  return (
    <>
      <div className="absolute right-4 top-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              disabled={isDefaultSystem}
              onClick={() => {
                if (!isDefaultSystem && onDelete) {
                  onDelete();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h3 className="mb-2 pr-10 font-semibold transition-colors group-hover:text-primary">
        {name}
      </h3>
      {description && (
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      )}
    </>
  );
}

type SystemCardMetricsProps = {
  deploymentCount: number;
  environmentCount: number;
};

function SystemCardMetrics({
  deploymentCount,
  environmentCount,
}: SystemCardMetricsProps) {
  return (
    <div className="flex gap-4 text-sm text-muted-foreground">
      <div>
        <span className="font-medium">{deploymentCount}</span> deployment
        {deploymentCount !== 1 ? "s" : ""}
      </div>
      <div>
        <span className="font-medium">{environmentCount}</span> environment
        {environmentCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

export { SystemCard, SystemCardContent, SystemCardHeader, SystemCardMetrics };
