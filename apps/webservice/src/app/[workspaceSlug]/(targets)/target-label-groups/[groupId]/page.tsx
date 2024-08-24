"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@ctrlplane/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";

export default function TargetLabelGroupPages({
  params,
}: {
  params: { workspaceSlug: string; groupId: string };
}) {
  const { workspaceSlug, groupId } = params;
  const labelGroup = api.target.labelGroup.byId.useQuery(groupId);
  const router = useRouter();
  return (
    <div>
      <div className="flex items-center gap-3 border-b p-4 px-8 text-xl">
        <span className="">{labelGroup.data?.name}</span>
        <Badge className="rounded-full text-muted-foreground" variant="outline">
          {labelGroup.data?.groups.length}
        </Badge>
      </div>

      <Table className="w-full">
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead>Combinations</TableHead>
            <TableHead>Targets</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {labelGroup.data?.groups.map((group, idx) => {
            const { targets, ...combinations } = group;
            return (
              <TableRow key={idx}>
                <TableCell>
                  {Object.entries(combinations).map(([key, value]) => (
                    <div
                      key={key}
                      className="text-nowrap font-mono text-xs"
                      onClick={() =>
                        router.push(
                          `/${workspaceSlug}/targets?combinations=${encodeURIComponent(
                            JSON.stringify(combinations),
                          )}`,
                        )
                      }
                    >
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
    </div>
  );
}
