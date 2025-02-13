"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconChevronRight, IconDotsVertical } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";
import { Input } from "@ctrlplane/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";

import type { VariableData } from "./variable-data";
import { ResourceIcon } from "~/app/[workspaceSlug]/(appv2)/_components/resources/ResourceIcon";
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

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const [expandedVariables, setExpandedVariables] = useState<
    Record<string, boolean>
  >({});

  const [expandedValues, setExpandedValues] = useState<Record<string, boolean>>(
    {},
  );

  const switchVariableExpandedState = (variableId: string) =>
    setExpandedVariables((prev) => {
      const newState = { ...prev };
      const currentVariableState = newState[variableId] ?? false;
      newState[variableId] = !currentVariableState;
      return newState;
    });

  const switchValueExpandedState = (valueId: string) =>
    setExpandedValues((prev) => {
      const newState = { ...prev };
      const currentValueState = newState[valueId] ?? false;
      newState[valueId] = !currentValueState;
      return newState;
    });

  return (
    <>
      <div className="mb-[1px]">
        <Input
          value={search}
          className="rounded-none rounded-t-lg border-none hover:ring-0"
          type="text"
          placeholder="Filter variables..."
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 overflow-auto border-t bg-neutral-950">
        <Table className="table-fixed">
          <TableBody>
            {result.map((variable) => (
              <Collapsible key={variable.id} asChild>
                <>
                  <TableRow className="h-10 border-none">
                    <TableCell>
                      <div className="flex items-center gap-1 pl-1">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              switchVariableExpandedState(variable.id)
                            }
                          >
                            <IconChevronRight
                              className={cn(
                                "h4 w-4 transition-all",
                                expandedVariables[variable.id] && "rotate-90",
                              )}
                            />
                          </Button>
                        </CollapsibleTrigger>{" "}
                        {variable.key}
                      </div>
                    </TableCell>
                    <TableCell className="flex items-center justify-end gap-1">
                      <Badge
                        variant="outline"
                        className="flex h-6 justify-center hover:bg-secondary"
                      >
                        {variable.values.length} value
                        {variable.values.length === 1 ? "" : "s"}
                      </Badge>

                      <VariableDropdown variable={variable}>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <IconDotsVertical className="h-4 w-4" />
                        </Button>
                      </VariableDropdown>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <>
                      {variable.values.map((v, idx) => (
                        <Collapsible key={v.id} asChild>
                          <>
                            <TableRow
                              key={v.id}
                              className="h-10 border-none py-0"
                            >
                              <TableCell
                                className={cn(
                                  "h-10 py-0",
                                  idx === 0 && "pl-6",
                                  idx !== 0 && "pl-14",
                                )}
                              >
                                {idx !== 0 && (
                                  <div className="flex h-full items-center gap-1 border-l border-neutral-800 pl-4">
                                    <CollapsibleTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() =>
                                          switchValueExpandedState(v.id)
                                        }
                                      >
                                        <IconChevronRight
                                          className={cn(
                                            "h-4 w-4 transition-all",
                                            expandedValues[v.id] && "rotate-90",
                                          )}
                                        />
                                      </Button>
                                    </CollapsibleTrigger>
                                    <span className="rounded-md border-x border-y px-1 font-mono text-red-400">
                                      {String(v.value)}
                                    </span>
                                    {variable.defaultValueId === v.id && (
                                      <Badge className="hover:bg-primary">
                                        default
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                {idx === 0 && (
                                  <div className="flex h-full items-center">
                                    <div className="flex h-full flex-col justify-start">
                                      <div className="h-5 border-l border-neutral-800" />
                                    </div>
                                    <div className="h-[1px] w-[31px] flex-shrink-0 bg-neutral-800" />
                                    <div className="flex h-full items-center gap-1 border-l border-neutral-800 py-2 pl-4">
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() =>
                                            switchValueExpandedState(v.id)
                                          }
                                        >
                                          <IconChevronRight
                                            className={cn(
                                              "h4 w-4 transition-all",
                                              expandedValues[v.id] &&
                                                "rotate-90",
                                            )}
                                          />
                                        </Button>
                                      </CollapsibleTrigger>
                                      <span className="rounded-md border-x border-y px-1 font-mono text-red-400">
                                        {String(v.value)}
                                      </span>
                                      {variable.defaultValueId === v.id && (
                                        <Badge className="ml-2 hover:bg-primary">
                                          default
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="flex items-center justify-end gap-1">
                                <Badge
                                  variant="secondary"
                                  className="flex justify-center hover:bg-secondary"
                                >
                                  {v.resourceCount} resource
                                  {v.resourceCount === 1 ? "" : "s"}
                                </Badge>
                                <VariableValueDropdown
                                  value={v}
                                  variable={variable}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => e.preventDefault()}
                                  >
                                    <IconDotsVertical className="h-4 w-4" />
                                  </Button>
                                </VariableValueDropdown>
                              </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild className="py-0">
                              <>
                                {v.resources.map((r) => (
                                  <TableRow key={r.id} className="border-none">
                                    <TableCell
                                      className="h-10 cursor-pointer py-0 pl-[56px]"
                                      colSpan={2}
                                      // onClick={() => setResourceId(r.id)}
                                    >
                                      <Link
                                        href={`/${workspaceSlug}/resources/${r.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex h-full items-center border-l border-neutral-800 pl-7"
                                      >
                                        <div className="flex h-full items-center gap-2 border-l border-neutral-800 pl-6">
                                          <ResourceIcon
                                            version={r.version}
                                            kind={r.kind}
                                          />
                                          <div className="flex flex-col">
                                            <span className="overflow-hidden text-nowrap text-sm">
                                              {r.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              {r.version}
                                            </span>
                                          </div>
                                        </div>
                                      </Link>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {v.resourceCount !== 0 && (
                                  <TableRow className="border-none">
                                    <TableCell
                                      className="h-10 cursor-pointer py-0 pl-[56px]"
                                      colSpan={2}
                                    >
                                      <div className="flex h-full items-center border-l border-neutral-800 pl-7 text-muted-foreground hover:text-white">
                                        <Link
                                          className="flex h-full items-center gap-2 border-l border-neutral-800 pl-6"
                                          href={`/${workspaceSlug}/resources?filter=${v.filterHash}`}
                                          target="_blank"
                                        >
                                          <IconDotsVertical className="h-4 w-4" />
                                          View {v.resourceCount} resources...
                                        </Link>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                                {v.resourceCount === 0 && (
                                  <TableRow className="border-none">
                                    <TableCell
                                      className="h-10 cursor-pointer py-0 pl-[56px]"
                                      colSpan={2}
                                    >
                                      <div className="flex h-full items-center border-l border-neutral-800 pl-7 text-muted-foreground">
                                        No resources are using this variable
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
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
      </div>
    </>
  );
};
