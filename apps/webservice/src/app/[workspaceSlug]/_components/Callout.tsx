import { TbBulb } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";

export const Callout: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div
    className={cn(
      "flex w-fit flex-col gap-2 rounded-md bg-neutral-800/50 px-4 py-3 text-sm text-muted-foreground",
      className,
    )}
  >
    <TbBulb className="h-6 w-6 flex-shrink-0" />
    {children}
  </div>
);
