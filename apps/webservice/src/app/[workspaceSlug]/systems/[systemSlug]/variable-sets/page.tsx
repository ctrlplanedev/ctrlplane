import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconInfoCircle } from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../SystemsBreadcrumb";
import { TopNav } from "../../TopNav";
import { CreateVariableSetDialog } from "./CreateValueSetDialog";
import { VariableSetGettingStarted } from "./GettingStartedVariableSets";

export const metadata: Metadata = { title: "Value Sets - Systems" };

export default async function SystemValueSetsPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string };
}) {
  const system = await api.system.bySlug(params).catch(() => notFound());
  const variableSet = await api.variableSet.bySystemId(system.id);
  if (variableSet.length === 0)
    return <VariableSetGettingStarted systemId={system.id} />;

  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>
      {variableSet.length === 0 ? (
        <VariableSetGettingStarted systemId={system.id} />
      ) : (
        <>
          <div>
            <div className="flex items-center gap-4 border-b p-2 pl-4">
              <h1 className="flex-grow">Value Sets</h1>
              <CreateVariableSetDialog systemId={system.id}>
                <Button>Create variable set</Button>
              </CreateVariableSetDialog>
            </div>

            <div className="container mx-auto max-w-4xl space-y-4 p-8">
              <Alert variant="secondary">
                <IconInfoCircle className="h-4 w-4" />
                <AlertTitle>Variable conflicts and precedence</AlertTitle>
                <AlertDescription>
                  Conflicts occur when one or more variables applied to a
                  workspace have the same type and the same key.
                  Workspace-specific variables always overwrite conflicting
                  variables from variable sets. When different variable sets
                  contain conflicts, HCP Terraform prioritizes them first based
                  on the variable set scope and then by the lexical precedence
                  of the variable set name. Learn more about variable precedence
                </AlertDescription>
              </Alert>

              {variableSet.map((variableSet) => (
                <Link
                  className="block"
                  key={variableSet.id}
                  href={`variable-sets/${variableSet.id}`}
                >
                  <Card className="hover:bg-neutral-800/20">
                    <CardHeader>
                      <CardTitle>{variableSet.name}</CardTitle>
                      <CardDescription>
                        {variableSet.description ?? "Add a description..."}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
