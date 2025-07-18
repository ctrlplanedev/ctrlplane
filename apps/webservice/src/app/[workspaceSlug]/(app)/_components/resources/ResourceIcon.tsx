import {
  SiGit,
  SiGooglecloud,
  SiGooglecloudHex,
  SiGooglecloudstorage,
  SiGooglecloudstorageHex,
  SiKubernetes,
  SiSalesforce,
  SiSalesforceHex,
  SiTerraform,
} from "@icons-pack/react-simple-icons";
import {
  IconBucket,
  IconCloud,
  IconCloudDataConnectionFilled,
  IconCube,
  IconDatabase,
  IconLockFilled,
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
  if (kind?.toLowerCase().includes("git"))
    return <SiGit className={cn("h-4 w-4 shrink-0 text-red-300", className)} />;

  if (version.toLowerCase().includes("database"))
    return (
      <IconDatabase
        className={cn("h-4 w-4 shrink-0 text-cyan-300", className)}
      />
    );

  if (version.toLowerCase().includes("network"))
    return (
      <IconCloudDataConnectionFilled
        className={cn("h-4 w-4 shrink-0 text-neutral-300", className)}
      />
    );

  if (kind === "GoogleProject")
    return (
      <SiGooglecloud
        className={cn("h-4 w-4 shrink-0", className)}
        style={{ color: SiGooglecloudHex }}
      />
    );

  if (kind === "GoogleBucket")
    return (
      <SiGooglecloudstorage
        className={cn("h-4 w-4 shrink-0", className)}
        style={{ color: SiGooglecloudstorageHex }}
      />
    );

  if (kind?.toLowerCase().includes("salesforce"))
    return (
      <SiSalesforce
        className={cn("h-4 w-4 shrink-0", className)}
        style={{ color: SiSalesforceHex }}
      />
    );

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

  if (kind?.toLowerCase().includes("cloud"))
    return (
      <IconCloud className={cn("h-4 w-4 shrink-0 text-white", className)} />
    );

  if (kind?.toLowerCase().includes("storage"))
    return (
      <IconBucket className={cn("h-4 w-4 shrink-0 text-blue-300", className)} />
    );

  if (version.toLowerCase().includes("secret"))
    return (
      <IconLockFilled
        className={cn("h-4 w-4 shrink-0 text-amber-500", className)}
      />
    );

  if (version.includes("ctrlplane.access"))
    return (
      <IconTerminal
        className={cn("h-4 w-4 shrink-0 text-neutral-300", className)}
      />
    );

  return (
    <IconCube className={cn("h-4 w-4 shrink-0 text-neutral-300", className)} />
  );
};
