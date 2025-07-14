"use client";

import React, { useState } from "react";

import { Button } from "@ctrlplane/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@ctrlplane/ui/drawer";

import { WidgetComponents } from "../../[dashboardId]/_components/widgets/WidgetKinds";
import { useDashboard } from "../../[dashboardId]/DashboardContext";

export const CreateWidgetDrawer: React.FC = () => {
  const { isEditMode } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger disabled={!isEditMode} asChild>
        <Button variant="outline" size="sm" disabled={!isEditMode}>
          Create widget
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Create widget</DrawerTitle>
          <DrawerDescription>
            Drag and drop a widget to the dashboard to add it.
          </DrawerDescription>
        </DrawerHeader>
        <div className="grid grid-cols-4 gap-4 p-4">
          {Object.entries(WidgetComponents).map(
            ([key, { displayName, Icon }]) => (
              <div className="space-y-1" key={key}>
                <div
                  draggable
                  unselectable="on"
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", "");
                    e.dataTransfer.setData("widget-kind", key);
                    setIsOpen(false);
                  }}
                  className="flex cursor-grab flex-col items-center justify-center gap-2 rounded-md border p-2"
                >
                  <Icon />
                </div>
                <div className="text-sm">{displayName}</div>
              </div>
            ),
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
