"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Card } from "@ctrlplane/ui/card";

import { urls } from "~/app/urls";
import { EnvironmentCardContent } from "./EnvironmentCardContent";
import { EnvironmentCardHeader } from "./EnvironmentCardHeader";

export const EnvironmentCard: React.FC<{
  environment: SCHEMA.Environment;
}> = ({ environment }) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const environmentUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .environment(environment.id)
    .baseUrl();

  return (
    <Link href={environmentUrl} className="block">
      <Card className="h-56">
        <EnvironmentCardHeader environment={environment} />
        <EnvironmentCardContent environment={environment} />
      </Card>
    </Link>
  );
};
