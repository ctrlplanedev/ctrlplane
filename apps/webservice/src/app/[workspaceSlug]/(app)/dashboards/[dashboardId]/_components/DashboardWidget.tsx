import type * as SCHEMA from "@ctrlplane/db/schema";
import type React from "react";
import { IconEdit, IconEye, IconTrash } from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";

import { useExpandedWidget } from "../_hooks/useExpandedWidget";
import { useDashboard } from "../DashboardContext";

const DeleteWidgetConfirmationDialog: React.FC<{
  widgetId: string;
}> = ({ widgetId }) => {
  const { deleteWidget } = useDashboard();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <IconTrash className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete widget</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this widget?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.stopPropagation();
              deleteWidget(widgetId);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const WidgetActions: React.FC<{
  widgetId: string;
}> = ({ widgetId }) => {
  const { setExpandedWidget } = useExpandedWidget();
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={(e) => {
          e.stopPropagation();
          setExpandedWidget(widgetId);
        }}
      >
        <IconEye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={(e) => {
          e.stopPropagation();
          setExpandedWidget(widgetId, true);
        }}
      >
        <IconEdit className="h-4 w-4" />
      </Button>
      <DeleteWidgetConfirmationDialog widgetId={widgetId} />
    </div>
  );
};

export type DashboardWidget = {
  displayName: string;
  Icon: React.FC<{ className?: string }>;
  Component: React.FC<{ widget: SCHEMA.DashboardWidget }>;
};

type WidgetFullscreenProps = {
  widget: { id: string; name: string };
  WidgetExpanded: React.ReactNode;
  WidgetEditing: React.ReactNode;
};

export const WidgetFullscreen: React.FC<WidgetFullscreenProps> = ({
  widget,
  WidgetExpanded,
  WidgetEditing,
}) => {
  const {
    expandedWidgetId,
    isEditing,
    setExpandedWidget,
    clearExpandedWidget,
    setIsEditing,
  } = useExpandedWidget();

  return (
    <Dialog
      open={expandedWidgetId === widget.id}
      onOpenChange={(o) => {
        if (o) {
          setExpandedWidget(widget.id, isEditing);
          return;
        }
        clearExpandedWidget();
      }}
    >
      <DialogContent className="min-w-[1000px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{widget.name}</span>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsEditing(true)}
                >
                  <IconEdit className="h-4 w-4" />
                </Button>
              )}
              {isEditing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsEditing(false)}
                >
                  <IconEye className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        {isEditing ? WidgetEditing : WidgetExpanded}
      </DialogContent>
    </Dialog>
  );
};

export const DashboardWidgetCard: React.FC<{
  widget: { id: string; name: string };
  WidgetFullscreen: React.ReactNode;
  children: React.ReactNode;
}> = ({ widget, WidgetFullscreen, children }) => {
  return (
    <div className="flex h-full w-full flex-col rounded-sm border bg-background">
      <div className="flex items-center gap-2 border-b p-2">
        <div className="widget-drag-handle min-w-0 flex-grow cursor-move truncate">
          {widget.name}
        </div>
        <WidgetActions widgetId={widget.id} />
      </div>
      <div className="flex-1 overflow-y-auto p-2">{children}</div>
      {WidgetFullscreen}
    </div>
  );
};
