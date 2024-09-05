/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import type { Metadata } from "next";
import { TbEdit } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/server";
import { CreateValueSetDialog } from "./CreateValueSetDialog";

export const metadata: Metadata = { title: "Value Sets - Systems" };

export default async function SystemValueSetsPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string };
}) {
  const system = (await api.system.bySlug(params.systemSlug))!;
  const valueSet = await api.valueSet.bySystemId(system.id);

  return (
    <div>
      <div className="flex items-center gap-4 border-b p-2 pl-4">
        <h1 className="flex-grow">Value Sets</h1>
        <CreateValueSetDialog systemId={system.id}>
          <Button>Create Var</Button>
        </CreateValueSetDialog>
      </div>

      <div className="container mx-auto p-8">
        {valueSet.map((valueSet) => (
          <Card key={valueSet.id}>
            <CardHeader className="flex flex-row items-center">
              <div className="flex-grow">
                <CardTitle className="mb-1.5">{valueSet.name}</CardTitle>
                <CardDescription>
                  {valueSet.description || "Add a description..."}
                </CardDescription>
              </div>
              <div className="shrink-0">
                <Button variant="outline" size="sm" className="flex gap-2">
                  <TbEdit />
                  Edit
                </Button>
              </div>
            </CardHeader>

            <Table className="w-full border-t">
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="p-3">Key</TableHead>
                  <TableHead className="p-3">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valueSet.values.map((v, idx) => (
                  <TableRow key={v.id}>
                    <TableCell
                      className={cn(
                        "p-3",
                        idx === valueSet.values.length - 1 && "rounded-bl-lg",
                      )}
                    >
                      {v.key}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "p-3",
                        idx === valueSet.values.length - 1 && "rounded-br-lg",
                      )}
                    >
                      {v.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))}
      </div>
    </div>
  );
}
