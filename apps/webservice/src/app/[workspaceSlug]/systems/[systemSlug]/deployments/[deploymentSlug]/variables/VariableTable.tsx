"use client";

import type {
  DeploymentVariable,
  DeploymentVariableValue,
} from "@ctrlplane/db/schema";
import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { TbDotsVertical, TbPlus } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Input } from "@ctrlplane/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";
import { AddVariableValueDialog } from "../AddVariableValueDialog";

type VariableData = DeploymentVariable & { values: DeploymentVariableValue[] };

export const VariableTable: React.FC<{
  variables: VariableData[];
}> = ({ variables }) => {
  const del = api.deployment.variable.value.delete.useMutation();
  const router = useRouter();
  const { result, search, setSearch } = useMatchSorterWithSearch(variables, {
    keys: ["key", "description"],
  });
  return (
    <>
      <div className="sticky left-0 right-0 top-0 z-20 border-b bg-neutral-950">
        <Input
          value={search}
          className="rounded-none border-none hover:ring-0"
          type="text"
          placeholder="Filter variables..."
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.map((variable) => {
            return (
              <Fragment key={variable.id}>
                <TableRow>
                  <TableCell rowSpan={variable.values.length + 1}>
                    <div className="flex items-center gap-1">
                      {variable.key}
                      <AddVariableValueDialog variable={variable}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full text-muted-foreground"
                        >
                          <TbPlus />
                        </Button>
                      </AddVariableValueDialog>
                    </div>
                    <div className="text-muted-foreground">
                      {variable.description}
                    </div>
                  </TableCell>
                </TableRow>
                {variable.values.map((v, idx) => (
                  <TableRow
                    key={v.id}
                    className={
                      idx !== variable.values.length - 1
                        ? "border-b-neutral-900"
                        : ""
                    }
                  >
                    <TableCell>
                      <pre>{JSON.stringify(v.value)}</pre>
                    </TableCell>
                    <TableCell className="space-x-2">
                      {/* {v.deployments.map((d) => (
                        <div
                          key={d.id}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-blue-400 hover:bg-blue-500/15"
                        >
                          <TbShip /> {d.name}
                        </div>
                      ))}
                      {v.systems.map((d) => (
                        <div
                          key={d.id}
                          className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-green-400 hover:bg-green-500/15"
                        >
                          <TbCategory /> {d.name}
                        </div>
                      ))} */}
                    </TableCell>
                    <TableCell className="w-10">
                      {v.id != null && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <TbDotsVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={async () => {
                                if (v.id == null) return;
                                await del.mutateAsync(v.id);
                                router.refresh();
                              }}
                            >
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
};
