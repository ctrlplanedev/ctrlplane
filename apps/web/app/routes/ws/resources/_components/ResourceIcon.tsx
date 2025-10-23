import { SiKubernetes } from "@icons-pack/react-simple-icons";
import { Package } from "lucide-react";

import { cn } from "~/lib/utils";

export const ResourceIcon: React.FC<{
  kind: string;
  version: string;
  className?: string;
}> = ({ version, className }) => {
  if (version.includes("kubernetes"))
    return (
      <SiKubernetes
        className={cn("size-4 shrink-0 text-blue-300", className)}
      />
    );

  return (
    <Package
      className={cn(
        "size-4 shrink-0 text-muted-foreground dark:text-neutral-300",
        className,
      )}
    />
  );
};
