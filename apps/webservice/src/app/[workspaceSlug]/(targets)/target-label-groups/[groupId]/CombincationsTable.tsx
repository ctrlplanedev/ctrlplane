"use client";

import { useRouter } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

export const CombinationsTable: React.FC<{
  workspaceSlug: string;
  groups: Array<{ targets: number } & Record<string, string>>;
}> = ({ workspaceSlug, groups }) => {
  const router = useRouter();
  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow className="text-xs">
          <TableHead>Combinations</TableHead>
          <TableHead>Targets</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group, idx) => {
          const { targets, ...combinations } = group;
          return (
            <TableRow
              key={idx}
              className="cursor-pointer"
              onClick={() =>
                router.push(
                  `/${workspaceSlug}/targets?combinations=${encodeURIComponent(
                    JSON.stringify(combinations),
                  )}`,
                )
              }
            >
              <TableCell>
                {Object.entries(combinations).map(([key, value]) => (
                  <div key={key} className="text-nowrap font-mono text-xs">
                    <span className="text-red-400">{key}:</span>{" "}
                    <span className="text-green-300">{value}</span>
                  </div>
                ))}
              </TableCell>
              <TableCell>{targets}</TableCell>
            </TableRow>
          );
        })}
        <TableRow></TableRow>
      </TableBody>
    </Table>
  );
};
