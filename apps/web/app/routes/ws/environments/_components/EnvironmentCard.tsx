import { Calendar, Layers } from "lucide-react";
import { Link } from "react-router";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useWorkspace } from "~/components/WorkspaceProvider";

type EnvironmentCardProps = {
  environment: {
    id: string;
    name: string;
    description?: string;
    systemId: string;
    createdAt: string;
    resourceSelector?: { cel?: string; json?: Record<string, unknown> };
  };
  system: { id: string; name: string };
};

export const EnvironmentCard: React.FC<EnvironmentCardProps> = ({
  environment,
  system,
}) => {
  const { workspace } = useWorkspace();

  const environmentUrl = `/${workspace.slug}/environments/${environment.id}`;

  const formatDate = (date?: string) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Link to={environmentUrl} className="block">
      <Card className="h-56 transition-all hover:border-primary/50 hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="truncate">{environment.name}</span>
          </CardTitle>

          <CardDescription className="text-xs">{system.name}</CardDescription>

          {environment.description && (
            <p className="mt-2 text-xs text-muted-foreground">
              {environment.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {environment.resourceSelector?.cel && (
            <div className="flex items-start gap-2">
              <Layers className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <code className="block truncate rounded bg-muted px-2 py-1 text-xs">
                {environment.resourceSelector.cel}
              </code>
            </div>
          )}
          {environment.createdAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Created {formatDate(environment.createdAt)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};
