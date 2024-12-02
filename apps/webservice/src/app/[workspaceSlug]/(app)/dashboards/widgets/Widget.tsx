import type { ButtonProps } from "@ctrlplane/ui/button";
import React, { forwardRef } from "react";
import { IconMaximize, IconX } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Card, CardHeader } from "@ctrlplane/ui/card";

import { MOVE_BUTTON_CLASS_NAME } from "../DashboardGrid";

export const WidgetCard = forwardRef<HTMLDivElement, React.PropsWithChildren>(
  ({ children }, ref) => {
    return (
      <Card
        ref={ref}
        className="relative flex h-full w-full flex-col rounded-md border"
      >
        {children}
      </Card>
    );
  },
);

export const WidgetCardHeader = forwardRef<
  HTMLDivElement,
  React.PropsWithChildren
>(({ children }, ref) => (
  <CardHeader
    className="flex h-8 flex-row items-center gap-0.5 border-b px-1.5 py-0"
    ref={ref}
  >
    {children}
  </CardHeader>
));

export const WidgetCardTitle: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    className={`${MOVE_BUTTON_CLASS_NAME} flex-grow cursor-grab text-sm font-semibold`}
  >
    {children}
  </div>
);

export const WidgetCardBody: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="flex-grow">{children}</div>;

export const WidgetCardCloseButton: React.FC<ButtonProps> = (props) => {
  return (
    <div className="shrink-0">
      <Button
        variant="ghost"
        size="icon"
        {...props}
        className={cn("m-0 h-5 w-5 rounded-full", props.className)}
      >
        {props.children ?? <IconX className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};

export const WidgetCardExpandButton: React.FC<ButtonProps> = (props) => {
  return (
    <div className="shrink-0">
      <Button
        variant="ghost"
        size="icon"
        {...props}
        className={cn("m-0 h-5 w-5 rounded-full", props.className)}
      >
        {props.children ?? <IconMaximize className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};
