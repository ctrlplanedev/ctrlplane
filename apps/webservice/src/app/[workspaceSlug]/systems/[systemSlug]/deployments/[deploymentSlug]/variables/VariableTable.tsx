"use client";

import { useRouter } from "next/navigation";
import _ from "lodash";
import { TbDotsVertical, TbSelector } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";
import { Input } from "@ctrlplane/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import type { VariableData } from "./variable-data";
import { api } from "~/trpc/react";
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";
import { VariableDropdown } from "./VariableDropdown";
import { VariableValueDropdown } from "./VariableValueDropdown";

export const VariableTable: React.FC<{
  variables: VariableData[];
}> = ({ variables }) => {
  const router = useRouter();
  const { result, search, setSearch } = useMatchSorterWithSearch(variables, {
    keys: [
      "key",
      "description",
      (i) => i.values.map((v) => JSON.stringify(v.value)),
    ],
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
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.map((variable, idx) => {
            const numUniqueTargets = _.chain(variable.values)
              .flatMap((v) => v.targets)
              .uniqBy((t) => t.id)
              .value().length;

            const { values } = variable;

            console.log({ values });
            return (
              <Collapsible key={variable.id} asChild>
                <>
                  <TableRow className="border-none">
                    <TableCell className="flex items-center gap-2  ">
                      {/* <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mr-2 h-6 w-6 py-0 pl-[1px] hover:bg-inherit"
                          disabled={values.length === 0}
                        >
                          <TbSelector />
                        </Button>
                      </CollapsibleTrigger> */}
                      {variable.key}
                    </TableCell>
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-neutral-600"
                        >
                          {numUniqueTargets} target
                          {numUniqueTargets === 1 ? "" : "s"}
                        </Badge>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell className="flex justify-end ">
                      <VariableDropdown variable={variable}>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <TbDotsVertical />
                        </Button>
                      </VariableDropdown>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <>
                      {variable.values.map((v, idx) => (
                        <Collapsible key={v.id} asChild>
                          <>
                            <TableRow key={v.id} className="border-none">
                              <TableCell className="pl-12">{v.value}</TableCell>
                              <TableCell>
                                <CollapsibleTrigger asChild>
                                  <Badge
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-neutral-600"
                                  >
                                    {v.targets.length} target
                                    {v.targets.length === 1 ? "" : "s"}
                                  </Badge>
                                </CollapsibleTrigger>
                              </TableCell>
                              <TableCell className="flex justify-end">
                                <VariableValueDropdown value={v}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => e.preventDefault()}
                                  >
                                    <TbDotsVertical />
                                  </Button>
                                </VariableValueDropdown>
                              </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild>
                              <>
                                {v.targets.map((t) => (
                                  <TableRow key={t.id} className="border-none">
                                    <TableCell className="pl-20">
                                      {t.name}
                                    </TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                ))}
                              </>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      ))}
                    </>
                  </CollapsibleContent>
                </>
              </Collapsible>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
};
