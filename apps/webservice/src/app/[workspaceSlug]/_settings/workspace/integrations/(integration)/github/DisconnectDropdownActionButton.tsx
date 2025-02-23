"use client";

import React from "react";

import { DropdownMenuItem } from "@ctrlplane/ui/dropdown-menu";

export const DisconnectDropdownActionButton = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenuItem>
>((props, ref) => {
  return (
    <DropdownMenuItem {...props} ref={ref} onSelect={(e) => e.preventDefault()}>
      Disconnect
    </DropdownMenuItem>
  );
});
