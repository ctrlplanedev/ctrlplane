import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Users,
} from "lucide-react";
import { Link } from "react-router";

import type { MockSystem } from "../_mockData";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

type SystemCardProps = {
  system: MockSystem;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "degraded":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "healthy":
      return "text-green-500 border-green-500/20 bg-green-500/10";
    case "degraded":
      return "text-red-500 border-red-500/20 bg-red-500/10";
    case "warning":
      return "text-orange-500 border-orange-500/20 bg-orange-500/10";
    default:
      return "text-gray-500 border-gray-500/20 bg-gray-500/10";
  }
};

export function SystemCard({ system }: SystemCardProps) {
  return (
    <Link to={`/systems/${system.slug}`}>
      <Card className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold transition-colors group-hover:text-primary">
                  {system.name}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    getStatusColor(system.status),
                  )}
                >
                  {getStatusIcon(system.status)}
                  {system.status}
                </Badge>
              </div>
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Users className="h-3 w-3" />
                {system.owner}
              </CardDescription>
            </div>
          </div>
          {system.description && (
            <p className="mt-2 text-xs text-muted-foreground">
              {system.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                Deployments
              </span>
              <span className="font-medium">{system.deploymentCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Environments</span>
              <span className="font-medium">{system.environmentCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Resources</span>
              <span className="font-medium">{system.resourceCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active</span>
              <span className="font-medium">
                {system.activeDeployments} / {system.resourceCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Deployment</span>
              <span className="font-medium">{system.lastDeployment}</span>
            </div>
          </div>

          {/* Progress bar for active deployments */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Deployment Progress</span>
              <span>
                {Math.round(
                  (system.activeDeployments / system.resourceCount) * 100,
                )}
                %
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full transition-all",
                  system.status === "healthy"
                    ? "bg-green-500"
                    : system.status === "warning"
                      ? "bg-orange-500"
                      : "bg-red-500",
                )}
                style={{
                  width: `${(system.activeDeployments / system.resourceCount) * 100}%`,
                }}
              />
            </div>
          </div>

          {system.tags.length > 0 && (
            <div className="space-y-2">
              <Separator />
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {system.tags.slice(0, 3).map((tag, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs font-normal"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {system.tags.length > 3 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      +{system.tags.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          <Button variant="outline" className="w-full" size="sm">
            View Details
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
