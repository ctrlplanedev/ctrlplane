import {
  SiGit,
  SiKubernetes,
  SiTerraform,
} from "@icons-pack/react-simple-icons";
import {
  IconCloud,
  IconCube,
  IconServer,
  IconTerminal,
  IconUserDollar,
  IconUsersGroup,
} from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

export const ResourceIcon: React.FC<{
  version: string;
  kind?: string;
  className?: string;
}> = ({ version, kind, className }) => {
  if (kind?.toLowerCase().includes("shared"))
    return (
      <IconUsersGroup
        className={cn("h-4 w-4 shrink-0 text-blue-300", className)}
      />
    );
  if (kind?.toLowerCase().includes("customer"))
    return (
      <IconUserDollar
        className={cn("h-4 w-4 shrink-0 text-amber-500", className)}
      />
    );
  if (version.includes("kubernetes"))
    return (
      <SiKubernetes
        className={cn("h-4 w-4 shrink-0 text-blue-300", className)}
      />
    );
  if (version.includes("vm") || version.includes("compute"))
    return (
      <IconServer className={cn("h-4 w-4 shrink-0 text-cyan-300", className)} />
    );
  if (version.includes("terraform"))
    return (
      <SiTerraform
        className={cn("h-4 w-4 shrink-0 text-purple-300", className)}
      />
    );
  if (version.includes("ctrlplane.access"))
    return (
      <IconTerminal
        className={cn("h-4 w-4 shrink-0 text-neutral-300", className)}
      />
    );
  if (kind?.toLowerCase().includes("git"))
    return <SiGit className={cn("h-4 w-4 shrink-0 text-red-300", className)} />;
  if (kind?.toLowerCase().includes("cloud"))
    return (
      <IconCloud className={cn("h-4 w-4 shrink-0 text-white", className)} />
    );

  return (
    <IconCube className={cn("h-4 w-4 shrink-0 text-neutral-300", className)} />
  );
};
