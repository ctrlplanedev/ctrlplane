import { useState } from "react";
import { DiffEditor } from "@monaco-editor/react";

import { trpc } from "~/api/trpc";
import { useTheme } from "~/components/ThemeProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

type PlanDiffDialogProps = {
  deploymentId: string;
  resultId: string | undefined;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DiffView = "split" | "unified";

export function PlanDiffDialog({
  deploymentId,
  resultId,
  title,
  open,
  onOpenChange,
}: PlanDiffDialogProps) {
  const [view, setView] = useState<DiffView>("split");
  const { theme } = useTheme();

  const diffQuery = trpc.deployment.plans.resultDiff.useQuery(
    { deploymentId, resultId: resultId ?? "" },
    { enabled: open && resultId != null },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              theme={theme === "dark" ? "vs-dark" : "vs"}
              original={diffQuery.data.current}
              modified={diffQuery.data.proposed}
              options={{
                readOnly: true,
                renderSideBySide: view === "split",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                hideUnchangedRegions: {
                  enabled: true,
                  contextLineCount: 3,
                  minimumLineCount: 3,
                  revealLineCount: 20,
                },
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
