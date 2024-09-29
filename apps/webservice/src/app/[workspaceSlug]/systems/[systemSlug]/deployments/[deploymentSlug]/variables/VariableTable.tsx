"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SiKubernetes, SiTerraform } from "@icons-pack/react-simple-icons";
import {
  IconChevronRight,
  IconDotsVertical,
  IconServer,
  IconTarget,
} from "@tabler/icons-react";

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
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";
import { VariableDropdown } from "./VariableDropdown";
import { VariableValueDropdown } from "./VariableValueDropdown";

const TargetIcon: React.FC<{ version: string }> = ({ version }) => {
  if (version.includes("kubernetes"))
    return <SiKubernetes className="h-6 w-6 shrink-0 text-blue-300" />;
  if (version.includes("vm") || version.includes("compute"))
    return <IconServer className="h-6 w-6 shrink-0 text-cyan-300" />;
  if (version.includes("terraform"))
    return <SiTerraform className="h-6 w-6 shrink-0 text-purple-300" />;
  return <IconTarget className="h-6 w-6 shrink-0 text-neutral-300" />;
};

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
      <div className="sticky left-0 right-0 top-0 z-20 border-b bg-neutral-950">
        <Input
          value={search}
          className="rounded-none border-none hover:ring-0"
          type="text"
          placeholder="Filter variables..."
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-138px)] overflow-auto">
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
                  <TableRow className="h-10 border-none">
                    <TableCell>
                      <div className="flex items-center gap-1 pl-5">
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
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="flex w-24 justify-center hover:bg-secondary"
                      >
                        {variable.values.length} value
                        {variable.values.length === 1 ? "" : "s"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex w-full justify-end">
                        <VariableDropdown variable={variable}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <IconDotsVertical className="h-4 w-4" />
                          </Button>
                        </VariableDropdown>
                      </div>
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
                                  idx === 0 && "pl-10",
                                  idx !== 0 && "pl-[72px]",
                                )}
                              >
                                {idx !== 0 && (
                                  <div className="flex h-full items-center gap-1 border-l border-neutral-800 pl-7">
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
                                            expandedValues[v.id] && "rotate-90",
                                          )}
                                        />
                                      </Button>
                                    </CollapsibleTrigger>
                                    {String(v.value)}
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
                                    <div className="flex h-full items-center gap-1 border-l border-neutral-800 py-2 pl-7">
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
                                      {String(v.value)}
                                      {variable.defaultValueId === v.id && (
                                        <Badge className="ml-2 hover:bg-primary">
                                          default
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="py-[6px]">
                                <Badge
                                  variant="secondary"
                                  className="flex w-24 justify-center hover:bg-secondary"
                                >
                                  {v.targetCount} target
                                  {v.targetCount === 1 ? "" : "s"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end">
                                  <VariableValueDropdown value={v}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => e.preventDefault()}
                                    >
                                      <IconDotsVertical className="h-4 w-4" />
                                    </Button>
                                  </VariableValueDropdown>
                                </div>
                              </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild className="py-0">
                              <>
                                {v.targets.map((t, tIdx) => (
                                  <TableRow key={t.id} className="border-none">
                                    {tIdx !== 0 && (
                                      <TableCell className="h-10 py-0 pl-[72px]">
                                        <div className="flex h-full items-center border-l border-neutral-800 pl-[72px]">
                                          <div className="flex h-full items-center gap-2 border-l border-neutral-800 pl-7">
                                            <TargetIcon version={t.version} />
                                            <div className="flex flex-col">
                                              <span className="overflow-hidden text-nowrap text-sm">
                                                {t.name}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {t.version}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </TableCell>
                                    )}

                                    {tIdx === 0 && (
                                      <TableCell className="h-10 py-0 pl-[72px]">
                                        <div className="flex h-full items-center border-l border-neutral-800 pl-10">
                                          <div className="flex h-full items-center">
                                            <div className="flex h-full flex-col justify-start">
                                              <div className="h-5 border-l border-neutral-800" />
                                            </div>
                                            <div className="h-[1px] w-[31px] flex-shrink-0 bg-neutral-800" />
                                            <div className="flex h-full items-center gap-2 border-l border-neutral-800 pl-7">
                                              <TargetIcon version={t.version} />
                                              <div className="flex flex-col">
                                                <span className="overflow-hidden text-nowrap text-sm">
                                                  {t.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                  {t.version}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </TableCell>
                                    )}
                                    <TableCell />
                                    <TableCell />
                                  </TableRow>
                                ))}
                                <TableRow className="border-none">
                                  <TableCell className="h-10 cursor-pointer py-0 pl-[72px]">
                                    <div className="flex h-full items-center border-l border-neutral-800 pl-[72px]">
                                      <Link
                                        className="flex h-full items-center gap-2 border-l border-neutral-800 pl-7"
                                        href={`/${workspaceSlug}/targets?filter=${v.filterHash}`}
                                        target="_blank"
                                      >
                                        <IconDotsVertical className="h-4 w-4" />{" "}
                                        View {v.targetCount} targets...
                                      </Link>
                                    </div>
                                  </TableCell>
                                  <TableCell />
                                  <TableCell />
                                </TableRow>
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
