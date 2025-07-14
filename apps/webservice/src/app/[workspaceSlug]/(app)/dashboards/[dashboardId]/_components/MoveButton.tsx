import { IconGripVertical } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

import { MOVE_BUTTON_CLASS_NAME } from "../DashboardContext";

export const MoveButton: React.FC<{ className?: string }> = ({ className }) => (
  <IconGripVertical
    className={cn(
      `${MOVE_BUTTON_CLASS_NAME} h-4 w-4 cursor-grab text-neutral-500 hover:text-white`,
      className,
    )}
  />
);
