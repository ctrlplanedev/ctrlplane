"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconChevronRight,
  IconCode,
  IconDotsVertical,
  IconLink,
} from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import * as schema from "@ctrlplane/db/schema";
import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";
import { Input } from "@ctrlplane/ui/input";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import type { VariableData, VariableValue } from "./variable-data";
import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";
import { VariableDropdown } from "./VariableDropdown";
import { VariableValueDropdown } from "./VariableValueDropdown";

const VariableSearchInput: React.FC<{
  search: string;
  setSearch: (value: string) => void;
}> = ({ search, setSearch }) => (
  <div className="mb-[1px]">
    <Input
      value={search}
      className="rounded-none rounded-t-lg border-none hover:ring-0 focus-visible:ring-0"
      type="text"
      placeholder="Search variables..."
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>
);

const ResolvedValue: React.FC<{
  resource: schema.Resource;
  valueId: string;
}> = ({ resource, valueId }) => {
  const { data: resolvedValue, isLoading } =
    api.deployment.variable.value.resolveForResource.useQuery({
      resourceId: resource.id,
      valueId,
    });

  if (isLoading) return <Skeleton className="h-6 w-20" />;

  if (resolvedValue == null)
    return (
      <span className="rounded-md border border-blue-800/40 bg-blue-950/20 px-2 py-0.5 font-mono text-blue-300/90">
        null
      </span>
    );

  return (
    <span className="rounded-md border border-blue-800/40 bg-blue-950/20 px-2 py-0.5 font-mono text-blue-300/90">
      {typeof resolvedValue.value === "object"
        ? JSON.stringify(resolvedValue.value)
        : String(resolvedValue.value)}
    </span>
  );
};

const LazyResolvedValue: React.FC<{
  resource: schema.Resource;
  valueId: string;
}> = ({ resource, valueId }) => {
  const { ref, inView } = useInView();

  return (
    <div ref={ref}>
      {inView && <ResolvedValue resource={resource} valueId={valueId} />}
      {!inView && <Skeleton className="h-6 w-20" />}
    </div>
  );
};

const ResourceRow: React.FC<{
  resource: schema.Resource;
  workspaceUrls: ReturnType<typeof urls.workspace>;
  valueId: string;
  valueType: "direct" | "reference";
}> = ({ resource, workspaceUrls, valueId, valueType }) => (
  <TableRow className="border-none">
    <TableCell className="h-10 cursor-pointer py-0 pl-[56px]" colSpan={2}>
      <Link
        href={workspaceUrls.resource(resource.id).baseUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full items-center border-l border-neutral-800 pl-7"
      >
        <div className="flex h-full items-center gap-2 border-l border-neutral-800 pl-6">
          <ResourceIcon version={resource.version} kind={resource.kind} />
          <div className="flex flex-col">
            <span className="overflow-hidden text-nowrap text-sm">
              {resource.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {resource.version}
            </span>
          </div>
          {valueType === "reference" && (
            <LazyResolvedValue resource={resource} valueId={valueId} />
          )}
        </div>
      </Link>
    </TableCell>
  </TableRow>
);

const VariableValueRow: React.FC<{
  value: VariableValue;
  variable: VariableData;
  isFirst: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  workspaceUrls: ReturnType<typeof urls.workspace>;
}> = ({
  value,
  variable,
  isFirst,
  isExpanded,
  onToggleExpand,
  workspaceUrls,
}) => (
  <Collapsible key={value.id} asChild>
    <>
      <TableRow className="h-10 border-none py-0">
        <TableCell
          className={cn("h-10 py-0", isFirst && "pl-6", !isFirst && "pl-14")}
        >
          {!isFirst && (
            <div className="flex h-full items-center gap-1 border-l border-neutral-800 pl-4">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onToggleExpand}
                >
                  <IconChevronRight
                    className={cn(
                      "h-4 w-4 transition-all",
                      isExpanded && "rotate-90",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0"
                      >
                        {schema.isDeploymentVariableValueDirect(value) ? (
                          <IconCode className="h-4 w-4 text-blue-400/70" />
                        ) : (
                          <IconLink className="h-4 w-4 text-amber-400/70" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {schema.isDeploymentVariableValueDirect(value)
                        ? "Static value set directly"
                        : "Computed value based on resource reference"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {schema.isDeploymentVariableValueDirect(value) ? (
                  <span className="rounded-md border border-blue-800/40 bg-blue-950/20 px-2 py-0.5 font-mono text-blue-300/90">
                    {String(value.value)}
                  </span>
                ) : (
                  <span className="flex items-center rounded-md border border-amber-800/40 bg-amber-950/20 px-2 py-0.5">
                    {[value.reference, ...value.path].map((p, idx) => (
                      <React.Fragment key={p}>
                        {idx > 0 && (
                          <span className="mx-0.5 text-neutral-400">.</span>
                        )}
                        <span
                          className={cn(
                            "font-mono",
                            idx === 0
                              ? "text-amber-300/90"
                              : "text-green-300/90",
                          )}
                        >
                          {p}
                        </span>
                      </React.Fragment>
                    ))}
                  </span>
                )}
              </div>
            </div>
          )}
          {isFirst && (
            <div className="flex h-full items-center">
              <div className="flex h-full flex-col justify-start">
                <div className="h-5 border-l border-neutral-800" />
              </div>
              <div className="h-[1px] w-[31px] flex-shrink-0 bg-neutral-800" />
              <div className="flex h-full items-center gap-2 border-l border-neutral-800 py-2 pl-4">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onToggleExpand}
                  >
                    <IconChevronRight
                      className={cn(
                        "h4 w-4 transition-all",
                        isExpanded && "rotate-90",
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0"
                      >
                        {schema.isDeploymentVariableValueDirect(value) ? (
                          <IconCode className="h-4 w-4 text-blue-400/70" />
                        ) : (
                          <IconLink className="h-4 w-4 text-amber-400/70" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {schema.isDeploymentVariableValueDirect(value)
                        ? "Static value set directly"
                        : "Computed value based on resource reference"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {schema.isDeploymentVariableValueDirect(value) ? (
                  <span className="rounded-md border border-blue-800/40 bg-blue-950/20 px-2 py-0.5 font-mono text-blue-300/90">
                    {String(value.value)}
                  </span>
                ) : (
                  <span className="flex items-center rounded-md border border-amber-800/40 bg-amber-950/20 px-2 py-0.5">
                    {[value.reference, ...value.path].map((p, idx) => (
                      <React.Fragment key={p}>
                        {idx > 0 && (
                          <span className="mx-0.5 text-neutral-400">.</span>
                        )}
                        <span
                          className={cn(
                            "font-mono",
                            idx === 0
                              ? "text-amber-300/90"
                              : "text-green-300/90",
                          )}
                        >
                          {p}
                        </span>
                      </React.Fragment>
                    ))}
                  </span>
                )}
              </div>
            </div>
          )}
        </TableCell>
        <TableCell className="flex items-center justify-end gap-1">
          {variable.defaultValueId === value.id && (
            <Badge className="bg-purple-900/60 text-purple-200/90 hover:bg-purple-800/60">
              default
            </Badge>
          )}
          <Badge
            variant="secondary"
            className="flex justify-center hover:bg-secondary"
          >
            {value.resources.length} resource
            {value.resources.length === 1 ? "" : "s"}
          </Badge>
          <VariableValueDropdown value={value} variable={variable}>
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
          {value.resources.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              workspaceUrls={workspaceUrls}
              valueId={value.id}
              valueType={
                schema.isDeploymentVariableValueDirect(value)
                  ? "direct"
                  : "reference"
              }
            />
          ))}
          {value.resources.length !== 0 && (
            <TableRow className="border-none">
              <TableCell
                className="h-10 cursor-pointer py-0 pl-[56px]"
                colSpan={2}
              >
                <div className="flex h-full items-center border-l border-neutral-800 pl-7 text-muted-foreground hover:text-white">
                  <Link
                    className="flex h-full items-center gap-2 border-l border-neutral-800 pl-6"
                    href={workspaceUrls
                      .resources()
                      .filtered(value.resourceSelector)}
                    target="_blank"
                  >
                    <IconDotsVertical className="h-4 w-4" />
                    View {value.resources.length} resources...
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          )}
          {value.resources.length === 0 && (
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
);

const VariableRow: React.FC<{
  variable: VariableData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  expandedValues: Record<string, boolean>;
  onToggleValueExpand: (id: string) => void;
  workspaceUrls: ReturnType<typeof urls.workspace>;
}> = ({
  variable,
  isExpanded,
  onToggleExpand,
  expandedValues,
  onToggleValueExpand,
  workspaceUrls,
}) => (
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
                onClick={onToggleExpand}
              >
                <IconChevronRight
                  className={cn(
                    "h4 w-4 transition-all",
                    isExpanded && "rotate-90",
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
          {variable.values.map((value, idx) => (
            <VariableValueRow
              key={value.id}
              value={value}
              variable={variable}
              isFirst={idx === 0}
              isExpanded={!!expandedValues[value.id]}
              onToggleExpand={() => onToggleValueExpand(value.id)}
              workspaceUrls={workspaceUrls}
            />
          ))}
        </>
      </CollapsibleContent>
    </>
  </Collapsible>
);

export const VariableTable: React.FC<{
  variables: VariableData[];
}> = ({ variables }) => {
  const { result, search, setSearch } = useMatchSorterWithSearch(variables, {
    keys: [
      "key",
      "description",
      (i) =>
        i.values.map((v) =>
          schema.isDeploymentVariableValueDirect(v)
            ? JSON.stringify(v.value)
            : JSON.stringify(v.reference),
        ),
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

  const workspaceUrls = urls.workspace(workspaceSlug);

  return (
    <>
      <VariableSearchInput search={search} setSearch={setSearch} />
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 overflow-auto border-t bg-neutral-950">
        <Table className="table-fixed">
          <TableBody>
            {result.map((variable) => (
              <VariableRow
                key={variable.id}
                variable={variable}
                isExpanded={!!expandedVariables[variable.id]}
                onToggleExpand={() => switchVariableExpandedState(variable.id)}
                expandedValues={expandedValues}
                onToggleValueExpand={switchValueExpandedState}
                workspaceUrls={workspaceUrls}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
};
