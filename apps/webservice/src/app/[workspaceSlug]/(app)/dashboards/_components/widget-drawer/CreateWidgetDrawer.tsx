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

export const CreateWidgetDrawer: React.FC<{
  workspaceId: string;
}> = ({ workspaceId }) => {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Object.entries(WidgetComponents).map(([key, { displayName, Icon }]) => (
        <div
          draggable
          unselectable="on"
          key={key}
          onDragStart={(e) => e.dataTransfer.setData("text/plain", "")}
          className="flex flex-col items-center justify-center gap-2 rounded-md border p-2"
        >
          {Icon}
          <div>{displayName}</div>
        </div>
      ))}
    </div>
  );
};
