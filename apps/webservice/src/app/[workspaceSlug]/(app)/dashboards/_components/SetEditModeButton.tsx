"use client";

import { Button } from "@ctrlplane/ui/button";

import { useEditingWidget } from "../[dashboardId]/_hooks/useEditingWidget";
import { useDashboard } from "../[dashboardId]/DashboardContext";

export const SetEditModeButton: React.FC = () => {
  const { isEditMode: isCurrentlyEditMode, setIsEditMode } = useDashboard();
  const { clearEditingWidget } = useEditingWidget();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setIsEditMode(!isCurrentlyEditMode);
        if (isCurrentlyEditMode) clearEditingWidget();
      }}
    >
      {isCurrentlyEditMode ? "Exit edit mode" : "Edit"}
    </Button>
  );
};
