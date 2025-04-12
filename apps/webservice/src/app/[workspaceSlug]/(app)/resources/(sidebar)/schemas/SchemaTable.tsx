"use client";

import type { resourceSchema as ResourceSchema } from "@ctrlplane/db/schema";
import { useState } from "react";
import { IconTopologyComplex } from "@tabler/icons-react";
import range from "lodash/range";

import { Card } from "@ctrlplane/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { ConfigEditor } from "../../(raw)/[resourceId]/properties/ConfigEditor";

export const SchemaTable: React.FC<{
  workspace: { id: string };
  schemas: (typeof ResourceSchema.$inferSelect)[];
  isLoading: boolean;
}> = ({ schemas, isLoading }) => {
  const [selectedSchema, setSelectedSchema] = useState<
    typeof ResourceSchema.$inferSelect | null
  >(null);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {range(10).map((i) => (
          <Skeleton
            key={i}
            className="h-9 w-full"
            style={{ opacity: 1 * (1 - i / 10) }}
          />
        ))}
      </div>
    );
  }

  if (schemas.length === 0) {
    return (
      <Card className="m-4 flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/5">
          <IconTopologyComplex className="h-10 w-10 text-primary/60" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">No schemas found</h3>
        <p className="mb-8 max-w-md text-muted-foreground">
          Try adjusting your search to find what you're looking for.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schemas.map((schema) => (
              <TableRow
                key={schema.id}
                className="group cursor-pointer border-b-neutral-800/50 hover:bg-neutral-800/50"
                onClick={() => setSelectedSchema(schema)}
              >
                <TableCell>{schema.kind}</TableCell>
                <TableCell>{schema.version}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={selectedSchema !== null}
        onOpenChange={() => setSelectedSchema(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSchema?.kind} - {selectedSchema?.version}
            </DialogTitle>
          </DialogHeader>
          {selectedSchema && (
            <ConfigEditor
              value={JSON.stringify(selectedSchema.jsonSchema, null, 2)}
              readOnly
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
