"use client";

import { Button } from "@ctrlplane/ui/button";

import { useDashboard } from "../[dashboardId]/DashboardContext";

export const SetEditModeButton: React.FC = () => {
  const { isEditMode, setIsEditMode } = useDashboard();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsEditMode(!isEditMode)}
    >
      {isEditMode ? "Exit edit mode" : "Edit"}
    </Button>
  );
};
