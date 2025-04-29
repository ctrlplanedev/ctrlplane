"use client";

import { useRouter } from "next/navigation";
import LZString from "lz-string";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { urls } from "~/app/urls";

const CONDITION_PARAM = "condition";

export const CombinationsTable: React.FC<{
  workspaceSlug: string;
  keys: string[];
  combinations: Array<{
    resources: number;
    metadata: Record<string, string | null>;
  }>;
}> = ({ keys, workspaceSlug, combinations }) => {
  const router = useRouter();
  const resourceListUrl = urls.workspace(workspaceSlug).resources().list();
  return (
    <Table className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 relative h-full w-full flex-1 overflow-y-auto">
      <TableHeader className="sticky top-0 z-10 bg-neutral-900">
        <TableRow>
          {keys.map((key, idx) => (
            <TableHead key={idx}>
              <span className="text-md font-mono text-white">{key}</span>
            </TableHead>
          ))}
          <TableHead className="text-right text-white">Resources</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {combinations.map((combination, idx) => {
          const { resources, metadata } = combination;
          return (
            <TableRow
              key={idx}
              className="cursor-pointer"
              onClick={() => {
                const query = new URLSearchParams(window.location.search);
                const conditionHash = LZString.compressToEncodedURIComponent(
                  JSON.stringify({
                    type: "comparison",
                    operator: "and",
                    conditions: Object.entries(metadata).map(
                      ([key, value]) => ({
                        type: "metadata",
                        key,
                        ...(value != null
                          ? { value, operator: "equals" }
                          : { operator: "null" }),
                      }),
                    ),
                  }),
                );
                query.set(CONDITION_PARAM, conditionHash);
                return router.push(`${resourceListUrl}?${query.toString()}`);
              }}
            >
              {keys.map((key, idx) => {
                const value = metadata[key];
                const isBoolean = value === "true" || value === "false";
                return (
                  <TableCell key={idx} className="text-nowrap">
                    <div className="text-nowrap font-mono text-xs">
                      {isBoolean ? (
                        <span className="text-blue-300">{value}</span>
                      ) : (
                        <span className="text-green-400">{value}</span>
                      )}
                      {value == null && (
                        <span className="text-neutral-500">null</span>
                      )}
                    </div>
                  </TableCell>
                );
              })}
              <TableCell className="text-right">
                {resources.toLocaleString()}
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow></TableRow>
      </TableBody>
    </Table>
  );
};
