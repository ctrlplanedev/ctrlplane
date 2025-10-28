import {
  SiHelm,
  SiKubernetes,
  SiTerraform,
} from "@icons-pack/react-simple-icons";
import { Key, Package } from "lucide-react";

import { cn } from "~/lib/utils";

export const ResourceIcon: React.FC<{
  kind: string;
  version: string;
  className?: string;
}> = ({ version, className }) => {
  if (version.includes("kubernetes"))
    return (
      <SiKubernetes
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (version.includes("terraform"))
    return (
      <SiTerraform
        className={cn(
          "size-4 shrink-0 text-purple-500 dark:text-purple-300",
          className,
        )}
      />
    );

  if (version.includes("helm"))
    return (
      <SiHelm
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (version.includes("secret"))
    return (
      <Key
        className={cn(
          "size-4 shrink-0 text-amber-500 dark:text-amber-300",
          className,
        )}
      />
    );

  return (
    <Package
      className={cn("size-4 shrink-0 text-muted-foreground", className)}
    />
  );
};
