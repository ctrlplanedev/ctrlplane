import { useState } from "react";
import { Calendar, Layers, MoreVertical, Trash2 } from "lucide-react";
import { Link } from "react-router";

import { trpc } from "~/api/trpc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useWorkspace } from "~/components/WorkspaceProvider";

type EnvironmentCardProps = {
  environment: {
    id: string;
    name: string;
    description?: string;
    systemIds: string[];
    createdAt: Date;
    resourceSelector?: string;
  };
  systems: Array<{ id: string; name: string }>;
};

export const EnvironmentCard: React.FC<EnvironmentCardProps> = ({
  environment,
  systems,
}) => {
  const { workspace } = useWorkspace();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const environmentUrl = `/${workspace.slug}/environments/${environment.id}`;
  const utils = trpc.useUtils();

  const deleteEnvironment = trpc.environment.delete.useMutation({
    onSuccess: () => {
      void utils.environment.list.invalidate();
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void deleteEnvironment.mutate({
      workspaceId: workspace.id,
      environmentId: environment.id,
    });
    setShowDeleteDialog(false);
  };

  const formatDate = (date?: string | Date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      <Link to={environmentUrl} className="block">
        <Card className="h-56 transition-all hover:border-primary/50 hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="truncate">{environment.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.preventDefault()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.preventDefault()}
                >
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardTitle>

            <CardDescription className="text-xs">
              {systems.map((s) => s.name).join(", ") || "No system"}
            </CardDescription>

            {environment.description && (
              <p className="mt-2 text-xs text-muted-foreground">
                {environment.description}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <Layers className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <code className="block truncate rounded bg-muted px-2 py-1 text-xs">
                {environment.resourceSelector}
              </code>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Created {formatDate(environment.createdAt)}</span>
            </div>
          </CardContent>
        </Card>
      </Link>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Environment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{environment.name}</strong>? This action cannot be undone
              and will permanently remove the environment and all its associated
              data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
