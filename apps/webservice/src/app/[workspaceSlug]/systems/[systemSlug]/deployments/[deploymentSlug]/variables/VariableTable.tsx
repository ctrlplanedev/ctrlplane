"use client";

import { TbDotsVertical } from "react-icons/tb";

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
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";
import { VariableDropdown } from "./VariableDropdown";
import { VariableValueDropdown } from "./VariableValueDropdown";

export const VariableTable: React.FC<{
  variables: VariableData[];
}> = ({ variables }) => {
  const { result, search, setSearch } = useMatchSorterWithSearch(variables, {
    keys: [
      "key",
      "description",
      (i) => i.values.map((v) => JSON.stringify(v.value)),
    ],
  });

  variables.forEach((v) => {
    const defaultVal = v.values.find((val) => v.defaultValueId === val.id);
    console.log("defaultVal", { defaultVal });
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
          {result.map((variable) => (
            <Collapsible key={variable.id} asChild>
              <>
                <TableRow className="border-none">
                  <TableCell className="flex items-center gap-2  ">
                    {variable.key}
                  </TableCell>
                  <TableCell>
                    <CollapsibleTrigger asChild>
                      <Badge
                        variant="secondary"
                        className="flex w-24 cursor-pointer justify-center hover:bg-neutral-600"
                      >
                        {variable.values.length} value
                        {variable.values.length === 1 ? "" : "s"}
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
                          <TableRow key={v.id} className="border-none py-0">
                            <TableCell className="py-0 pl-10">
                              {idx !== variable.values.length - 1 && (
                                <div className="flex h-full items-center border-l border-neutral-800 py-2">
                                  <div className="mr-3 h-[1px] w-3 bg-neutral-800" />
                                  {v.value}
                                  {variable.defaultValueId === v.id && (
                                    <span className="ml-2">(default)</span>
                                  )}
                                </div>
                              )}
                              {idx === variable.values.length - 1 && (
                                <div className="flex h-full">
                                  <div className="flex h-full flex-col justify-start">
                                    <div className="h-[18px] border-l border-neutral-800" />
                                  </div>
                                  <div className="flex h-full items-center py-2">
                                    <div className="mr-3 h-[1px] w-3 bg-neutral-800" />
                                    {v.value}{" "}
                                    {variable.defaultValueId === v.id && (
                                      <Badge className="ml-2 py-[1px] text-xs">
                                        default
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-[6px]">
                              <CollapsibleTrigger asChild>
                                <Badge
                                  variant="secondary"
                                  className="flex w-24 cursor-pointer justify-center py-[2px] hover:bg-neutral-600"
                                >
                                  {v.targetCount} target
                                  {v.targetCount === 1 ? "" : "s"}
                                </Badge>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="flex h-max items-center justify-end py-[5px]">
                              <VariableValueDropdown value={v}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 "
                                  onClick={(e) => e.preventDefault()}
                                >
                                  <TbDotsVertical />
                                </Button>
                              </VariableValueDropdown>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild className="py-0">
                            <>
                              {v.targets.map((t, tIdx) => (
                                <TableRow key={t.id} className="border-none">
                                  {idx !== variable.values.length - 1 && (
                                    <TableCell className="py-0 pl-10">
                                      <div className="flex h-full items-center border-l border-neutral-800 pl-10">
                                        {tIdx !== v.targets.length - 1 && (
                                          <div className="flex h-full items-center border-l border-neutral-800 py-2">
                                            <div className="mr-3 h-[1px] w-3 bg-neutral-800" />
                                            {t.name}
                                          </div>
                                        )}
                                        {tIdx === v.targets.length - 1 && (
                                          <div className="flex h-full">
                                            <div className="flex h-full flex-col justify-start">
                                              <div className="h-[18px] border-l border-neutral-800" />
                                            </div>
                                            <div className="flex h-full items-center py-2">
                                              <div className="mr-3 h-[1px] w-3 bg-neutral-800" />
                                              {t.name}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                  )}

                                  {idx === variable.values.length - 1 && (
                                    <TableCell className="py-0 pl-20">
                                      {tIdx !== v.targets.length - 1 && (
                                        <div className="flex h-full items-center border-l border-neutral-800 py-2">
                                          <div className="mr-3 h-[1px] w-3 bg-neutral-800" />
                                          {t.name}
                                        </div>
                                      )}

                                      {tIdx === v.targets.length - 1 && (
                                        <div className="flex h-full">
                                          <div className="flex h-full flex-col justify-start">
                                            <div className="h-[18px] border-l border-neutral-800" />
                                          </div>
                                          <div className="flex h-full items-center py-2">
                                            <div className="mr-3 h-[1px] w-3 bg-neutral-800" />
                                            {t.name}
                                          </div>
                                        </div>
                                      )}
                                    </TableCell>
                                  )}
                                  <TableCell className="py-0" />
                                  <TableCell className="py-0" />
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
          ))}
        </TableBody>
      </Table>
    </>
  );
};
