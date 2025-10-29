import {
  SiAmazons3,
  SiApachekafka,
  SiGithub,
  SiGooglebigtable,
  SiGooglecloudstorage,
  SiHelm,
  SiKubernetes,
  SiMysql,
  SiPostgresql,
  SiRabbitmq,
  SiRedis,
  SiSalesforce,
  SiTerraform,
} from "@icons-pack/react-simple-icons";
import { Database, File, Key, Network, Package } from "lucide-react";

import { cn } from "~/lib/utils";

export const ResourceIcon: React.FC<{
  kind: string;
  version: string;
  className?: string;
}> = ({ version, kind, className }) => {
  version = version.toLowerCase();
  kind = kind.toLowerCase();

  const contains = (str: string) => {
    return version.includes(str) || kind.includes(str);
  };

  if (contains("kubernetes"))
    return (
      <SiKubernetes
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (contains("terraform"))
    return (
      <SiTerraform
        className={cn(
          "size-4 shrink-0 text-purple-500 dark:text-purple-300",
          className,
        )}
      />
    );

  if (contains("helm"))
    return (
      <SiHelm
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (contains("secret"))
    return (
      <Key
        className={cn(
          "size-4 shrink-0 text-amber-500 dark:text-amber-300",
          className,
        )}
      />
    );

  if (contains("redis"))
    return (
      <SiRedis
        className={cn(
          "size-4 shrink-0 text-red-500 dark:text-red-300",
          className,
        )}
      />
    );

  if (contains("kafka"))
    return (
      <SiApachekafka
        className={cn(
          "size-4 shrink-0 text-orange-500 dark:text-orange-300",
          className,
        )}
      />
    );

  if (contains("mysql"))
    return (
      <SiMysql
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (contains("postgres"))
    return (
      <SiPostgresql
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (contains("rabbitmq"))
    return (
      <SiRabbitmq
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (contains("s3"))
    return (
      <SiAmazons3
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (contains("salesforce"))
    return (
      <SiSalesforce
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (contains("github"))
    return (
      <SiGithub
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (contains("redis"))
    return (
      <Package
        className={cn("size-4 shrink-0 text-muted-foreground", className)}
      />
    );

  if (contains("bigtable"))
    return (
      <SiGooglebigtable
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (contains("network") || contains("vpc"))
    return (
      <Network
        className={cn(
          "size-4 shrink-0 text-neutral-500 dark:text-neutral-300",
          className,
        )}
      />
    );

  if (contains("database"))
    return <Database className={cn("size-4 shrink-0", className)} />;

  if (contains("google") || contains("bucket"))
    return (
      <SiGooglecloudstorage
        className={cn(
          "size-4 shrink-0 text-blue-500 dark:text-blue-300",
          className,
        )}
      />
    );

  if (contains("bucket") || contains("storage"))
    return (
      <File
        className={cn("size-4 shrink-0 text-muted-foreground", className)}
      />
    );

  return (
    <Package
      className={cn("size-4 shrink-0 text-muted-foreground", className)}
    />
  );
};
