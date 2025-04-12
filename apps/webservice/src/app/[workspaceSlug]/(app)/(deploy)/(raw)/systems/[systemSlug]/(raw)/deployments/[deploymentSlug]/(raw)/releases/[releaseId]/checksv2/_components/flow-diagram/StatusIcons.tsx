import { IconCheck, IconLoader2, IconMinus, IconX } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

export const Passing: React.FC = () => (
  <div className="rounded-full bg-green-400 p-0.5 dark:text-black">
    <IconCheck strokeWidth={3} className="h-3 w-3" />
  </div>
);

export const Failing: React.FC = () => (
  <div className="rounded-full bg-red-400 p-0.5 dark:text-black">
    <IconX strokeWidth={3} className="h-3 w-3" />
  </div>
);

export const Waiting: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      "animate-spin rounded-full bg-blue-400 p-0.5 dark:text-black",
      className,
    )}
  >
    <IconLoader2 strokeWidth={3} className="h-3 w-3" />
  </div>
);

export const Loading: React.FC = () => (
  <div className="rounded-full bg-muted-foreground p-0.5 dark:text-black">
    <IconLoader2 strokeWidth={3} className="h-3 w-3 animate-spin" />
  </div>
);

export const Cancelled: React.FC = () => (
  <div className="rounded-full bg-neutral-400 p-0.5 dark:text-black">
    <IconMinus strokeWidth={3} className="h-3 w-3" />
  </div>
);
