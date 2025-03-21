"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { IconFilter, IconSearch } from "@tabler/icons-react";
import _ from "lodash";

import { Badge } from "@ctrlplane/ui/badge";
import { Input } from "@ctrlplane/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { ResourceCard } from "./ResourceCard";
import { useFilteredResources } from "./useFilteredResources";

export const ResourcesPageContent: React.FC<{
  environment: SCHEMA.Environment;
  workspaceId: string;
}> = ({ environment, workspaceId }) => {
  const { resources } = useFilteredResources(
    workspaceId,
    environment.resourceFilter,
  );

  const [selectedView, setSelectedView] = useState("grid");
  const [showFilterEditor, setShowFilterEditor] = useState(false);
  const [resourceFilter, setResourceFilter] = useState({
    type: "comparison",
    operator: "and",
    not: false,
    conditions: [
      {
        type: "kind",
        operator: "equals",
        not: false,
        value: "Pod",
      },
    ],
  });

  // Group resources by component
  const resourcesByVersion = _(resources)
    .groupBy((t) => t.version)
    .value() as Record<string, typeof resources>;
  const resourcesByKind = _(resources)
    .groupBy((t) => t.version + ": " + t.kind)
    .value() as Record<string, typeof resources>;

  const filteredResources = resources;

  return (
    <div className="space-y-6">
      {/* Resource Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 text-xs text-neutral-400">Total Resources</div>
          <div className="text-2xl font-semibold text-neutral-100">
            {resources.length}
          </div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-neutral-400">
              Across {Object.keys(resourcesByKind).length} kinds
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span>Healthy</span>
          </div>
          <div className="text-2xl font-semibold text-green-400">10</div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-green-400">{10}% of resources</span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-amber-500"></div>
            <span>Needs Attention</span>
          </div>
          <div className="text-2xl font-semibold text-amber-400">{0}</div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-amber-400">
              {0 > 0 ? "Action required" : "No issues detected"}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
            <span>Deploying</span>
          </div>
          <div className="text-2xl font-semibold text-blue-400">{0 + 0}</div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-blue-400">
              {0 > 0 ? "Updates in progress" : "No active deployments"}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            className="w-full pl-8 md:w-80"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="cursor-pointer transition-colors hover:bg-neutral-800/50"
            onClick={() => setShowFilterEditor(true)}
          >
            <IconFilter className="mr-1 h-3.5 w-3.5" />
            {resourceFilter.conditions.length > 0
              ? `Filter (${resourceFilter.conditions.length})`
              : "Filter"}
          </Badge>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="all">All Kinds</option>
            {Object.keys(resourcesByKind).map((kind) => (
              <option key={kind} value={kind.toLowerCase()}>
                {kind}
              </option>
            ))}
          </select>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="all">All Versions</option>
            {Object.keys(resourcesByVersion).map((version) => (
              <option key={version} value={version.toLowerCase()}>
                {version}
              </option>
            ))}
          </select>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="all">All Status</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="failed">Failed</option>
            <option value="updating">Updating</option>
          </select>
          <div className="flex rounded-md border border-neutral-800 bg-neutral-900">
            <button
              className={`px-3 py-1 ${selectedView === "grid" ? "bg-neutral-800" : "hover:bg-neutral-800/50"}`}
              onClick={() => setSelectedView("grid")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              className={`px-3 py-1 ${selectedView === "list" ? "bg-neutral-800" : "hover:bg-neutral-800/50"}`}
              onClick={() => setSelectedView("list")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Resource Content */}
      {selectedView === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredResources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-800">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-neutral-800 hover:bg-transparent">
                <TableHead className="w-1/6 font-medium text-neutral-400">
                  Name
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Kind
                </TableHead>
                <TableHead className="w-1/6 font-medium text-neutral-400">
                  Component
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Provider
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Region
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Success Rate
                </TableHead>
                <TableHead className="w-1/6 font-medium text-neutral-400">
                  Last Updated
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((resource) => (
                <TableRow
                  key={resource.id}
                  className="border-b border-neutral-800/50 hover:bg-neutral-800/20"
                >
                  <TableCell className="py-3 font-medium text-neutral-200">
                    {resource.name}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.kind}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.version}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.providerId}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.providerId}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-neutral-800">
                        <div
                          className={`h-full rounded-full ${
                            resource.healthScore > 90
                              ? "bg-green-500"
                              : resource.healthScore > 70
                                ? "bg-amber-500"
                                : resource.healthScore > 0
                                  ? "bg-red-500"
                                  : "bg-neutral-600"
                          }`}
                          style={{ width: `${resource.healthScore}%` }}
                        />
                      </div>
                      <span className="text-sm">{resource.healthScore}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-neutral-400">
                    {resource.lastUpdated.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={
                        resource.status === "healthy"
                          ? "border-green-500/30 bg-green-500/10 text-green-400"
                          : resource.status === "degraded"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                            : resource.status === "failed"
                              ? "border-red-500/30 bg-red-500/10 text-red-400"
                              : resource.status === "updating"
                                ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                : "border-neutral-500/30 bg-neutral-500/10 text-neutral-400"
                      }
                    >
                      {resource.status.charAt(0).toUpperCase() +
                        resource.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-neutral-400">
        <div>
          {filteredResources.length === resources.length ? (
            <>Showing all {resources.length} resources</>
          ) : (
            <>
              Showing {filteredResources.length} of {resources.length} resources
            </>
          )}
          {resourceFilter.conditions.length > 0 && (
            <>
              {" "}
              • <span className="text-blue-400">Filtered</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-neutral-800 px-3 py-1 transition-colors hover:bg-neutral-800/30">
            Previous
          </button>
          <button className="rounded-md border border-neutral-800 bg-neutral-800/40 px-3 py-1 transition-colors hover:bg-neutral-800/60">
            Next
          </button>
        </div>
      </div>

      {/* Resource Filter Editor Modal */}
      {showFilterEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-h-[80vh] w-[800px] overflow-auto rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 p-4">
              <h3 className="text-lg font-medium text-neutral-100">
                Edit Resource Filter
              </h3>
              <button
                onClick={() => setShowFilterEditor(false)}
                className="text-neutral-400 hover:text-neutral-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* Current Conditions */}
              <div>
                <h4 className="mb-3 text-sm font-medium">
                  Current Filter Conditions
                </h4>

                {resourceFilter.conditions.length > 0 ? (
                  <div className="space-y-2">
                    {resourceFilter.conditions.map(
                      (condition: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-800/30 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-blue-400">
                              {condition.type.charAt(0).toUpperCase() +
                                condition.type.slice(1)}
                            </span>
                            <span className="text-xs text-neutral-400">
                              equals
                            </span>
                            <span className="rounded bg-neutral-800 px-2 py-1 text-xs">
                              {condition.value}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const newFilter = { ...resourceFilter };
                              newFilter.conditions =
                                resourceFilter.conditions.filter(
                                  (_: any, i: number) => i !== index,
                                );
                              setResourceFilter(newFilter);
                            }}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-neutral-800 p-4 text-center text-sm text-neutral-400">
                    No filter conditions set. Resources will not be filtered.
                  </div>
                )}
              </div>

              {/* Add New Condition */}
              <div>
                <h4 className="mb-3 text-sm font-medium">Add New Condition</h4>

                <div className="grid grid-cols-12 gap-3">
                  {/* Condition Type */}
                  <div className="col-span-3">
                    <label className="mb-1 block text-xs text-neutral-400">
                      Condition Type
                    </label>
                    <select
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                      defaultValue="kind"
                      id="condition-type"
                    >
                      <option value="kind">Resource Kind</option>
                      <option value="provider">Provider</option>
                      <option value="status">Status</option>
                      <option value="component">Component</option>
                    </select>
                  </div>

                  {/* Operator - Static for now */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-neutral-400">
                      Operator
                    </label>
                    <select
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                      disabled
                    >
                      <option>equals</option>
                    </select>
                  </div>

                  {/* Condition Value */}
                  <div className="col-span-5">
                    <label className="mb-1 block text-xs text-neutral-400">
                      Value
                    </label>
                    <select
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                      id="condition-value"
                    >
                      {/* Dynamically populate options based on condition type */}
                      <option value="">Select a value...</option>
                      <option value="Pod">Pod</option>
                      <option value="Service">Service</option>
                      <option value="Database">Database</option>
                      <option value="VM">VM</option>
                      <option value="kubernetes">kubernetes</option>
                      <option value="aws">aws</option>
                      <option value="gcp">gcp</option>
                      <option value="healthy">healthy</option>
                      <option value="degraded">degraded</option>
                      <option value="failed">failed</option>
                      <option value="updating">updating</option>
                      {Object.keys(resourcesByComponent).map((component) => (
                        <option key={component} value={component}>
                          {component}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Add Button */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-neutral-400">
                      &nbsp;
                    </label>
                    <button
                      className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      onClick={() => {
                        const typeSelect = document.getElementById(
                          "condition-type",
                        ) as HTMLSelectElement;
                        const valueSelect = document.getElementById(
                          "condition-value",
                        ) as HTMLSelectElement;

                        if (typeSelect && valueSelect && valueSelect.value) {
                          const newCondition = {
                            type: typeSelect.value,
                            operator: "equals",
                            not: false,
                            value: valueSelect.value,
                          };

                          const newFilter = { ...resourceFilter };
                          newFilter.conditions = [
                            ...resourceFilter.conditions,
                            newCondition,
                          ];
                          setResourceFilter(newFilter);
                        }
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Description of the filter effect */}
              <div className="rounded-md border border-neutral-800 bg-neutral-800/30 p-4">
                <h4 className="mb-2 text-sm font-medium">Filter Effect</h4>
                <p className="text-sm text-neutral-400">
                  This filter will{" "}
                  {resourceFilter.conditions.length > 0
                    ? "show only"
                    : "show all"}{" "}
                  resources
                  {resourceFilter.conditions.length > 0 && " that match"}
                  {resourceFilter.conditions.length > 1 &&
                    resourceFilter.operator === "and" &&
                    " all"}
                  {resourceFilter.conditions.length > 1 &&
                    resourceFilter.operator === "or" &&
                    " any"}
                  {resourceFilter.conditions.length > 0 &&
                    " of these conditions."}
                </p>
                {resourceFilter.conditions.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="font-medium text-blue-400">
                      Currently filtering:{" "}
                    </span>
                    {resourceFilter.conditions.map((c: any, i: number) => (
                      <span key={i} className="text-neutral-300">
                        {i > 0 && (
                          <span className="text-neutral-500">
                            {" "}
                            {resourceFilter.operator}{" "}
                          </span>
                        )}
                        {c.type} {c.operator} "{c.value}"
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Save and Cancel Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  className="rounded-md border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
                  onClick={() => setShowFilterEditor(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={() => {
                    // In a real application, this would save the filter to the backend
                    // and then close the editor
                    setShowFilterEditor(false);
                  }}
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
