import { IconGripVertical } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

import { MOVE_BUTTON_CLASS_NAME } from "../DashboardGrid";

export const MoveButton: React.FC<{ className?: string }> = ({ className }) => (
  <IconGripVertical
    className={cn(
      `${MOVE_BUTTON_CLASS_NAME} h-3 w-3 cursor-grab text-xl text-neutral-500 hover:text-white`,
      className,
    )}
  />
);
