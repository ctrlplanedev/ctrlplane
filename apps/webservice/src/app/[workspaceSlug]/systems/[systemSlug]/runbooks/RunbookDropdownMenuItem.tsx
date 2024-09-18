"use client";

import { forwardRef } from "react";

import { DropdownMenuItem } from "@ctrlplane/ui/dropdown-menu";

export const RunbookDropdownMenuItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenuItem>
>((props, ref) => (
  <DropdownMenuItem {...props} ref={ref} onSelect={(e) => e.preventDefault()}>
    {props.children}
  </DropdownMenuItem>
));
