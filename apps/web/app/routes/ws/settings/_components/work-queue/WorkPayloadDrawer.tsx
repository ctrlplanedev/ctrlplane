import type React from "react";
import { formatDistanceToNowStrict } from "date-fns";

import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

import { trpc } from "~/api/trpc";

export const WorkPayloadDrawer: React.FC<{
  scopeId: number | null;
  onClose: () => void;
}> = ({ scopeId, onClose }) => {
  const payloadsQuery = trpc.reconcile.listWorkPayloads.useQuery(
    { scopeId: scopeId! },
    { enabled: scopeId != null },
  );

  const payloads = payloadsQuery.data ?? [];

  return (
    <Sheet open={scopeId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Work Payloads</SheetTitle>
          <SheetDescription>
            Payloads associated with scope #{scopeId}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {payloadsQuery.isLoading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-md" />
              ))}
            </div>
          )}

          {!payloadsQuery.isLoading && payloads.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No payloads for this scope
            </p>
          )}

          <div className="flex flex-col gap-3">
            {payloads.map((payload) => (
              <div
                key={payload.id}
                className="rounded-md border bg-card p-3 text-card-foreground"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{payload.payloadType || "default"}</Badge>
                    {payload.payloadKey && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {payload.payloadKey}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(payload.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Attempts: {payload.attemptCount}</span>
                  {payload.lastError && (
                    <span className="text-destructive">Has error</span>
                  )}
                </div>

                {payload.lastError && (
                  <div className="mb-2 rounded bg-destructive/10 p-2 font-mono text-xs text-destructive">
                    {payload.lastError}
                  </div>
                )}

                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Payload data
                  </summary>
                  <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(payload.payload, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
