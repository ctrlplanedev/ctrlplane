import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import { api } from "~/trpc/server";
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
  if (variableSet.length === 0) return <VariableSetGettingStarted />;

  return (
    <div>
      <div className="flex items-center gap-4 border-b p-2 pl-4">
        <h1 className="flex-grow">Value Sets</h1>
        <CreateVariableSetDialog systemId={system.id}>
          <Button>Create variable set</Button>
        </CreateVariableSetDialog>
      </div>

      <div className="container mx-auto space-y-4 p-8">
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
  );
}
