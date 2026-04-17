import { useState } from "react";
import { DiffEditor } from "@monaco-editor/react";

import { trpc } from "~/api/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

type PlanDiffDialogProps = {
  deploymentId: string;
  resultId: string;
  title: string;
  children: React.ReactNode;
};

type DiffView = "split" | "unified";

export function PlanDiffDialog({
  deploymentId,
  resultId,
  title,
  children,
}: PlanDiffDialogProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DiffView>("split");

  const diffQuery = trpc.deployment.plans.resultDiff.useQuery(
    { deploymentId, resultId },
    { enabled: open },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col p-0 sm:max-w-[95vw]">
        <DialogHeader className="flex-row items-center justify-between border-b p-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <Tabs value={view} onValueChange={(v) => setView(v as DiffView)}>
            <TabsList>
              <TabsTrigger value="split">Split</TabsTrigger>
              <TabsTrigger value="unified">Unified</TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          {diffQuery.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading diff...
            </div>
          ) : diffQuery.data == null ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No diff available
            </div>
          ) : (
            <DiffEditor
              height="100%"
              language="yaml"
              theme="vs-dark"
              original={diffQuery.data.current}
              modified={diffQuery.data.proposed}
              options={{
                readOnly: true,
                renderSideBySide: view === "split",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
