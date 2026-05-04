import type { RouterOutputs } from "@ctrlplane/trpc";
import { useEffect, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";

import { trpc } from "~/api/trpc";
import { useTheme } from "~/components/ThemeProvider";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

type PlanDiffDialogProps = {
  deploymentId: string;
  resultId: string | undefined;
  title: string;
  open: boolean;
  initialTab?: TopTab;
  onOpenChange: (open: boolean) => void;
};

type TopTab = "diff" | "validations";
type DiffView = "split" | "unified";

type Validation =
  RouterOutputs["deployment"]["plans"]["resultValidations"][number];

function ValidationsTab({
  deploymentId,
  resultId,
  open,
}: {
  deploymentId: string;
  resultId: string;
  open: boolean;
}) {
  const query = trpc.deployment.plans.resultValidations.useQuery(
    { deploymentId, resultId },
    { enabled: open },
  );

  if (query.isLoading)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading validations...
      </div>
    );

  const validations = query.data ?? [];
  if (validations.length === 0)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No validations evaluated for this result
      </div>
    );

  return (
    <div className="h-full overflow-auto p-4">
      <ul className="space-y-3">
        {validations.map((v) => (
          <ValidationItem key={v.id} validation={v} />
        ))}
      </ul>
    </div>
  );
}

function ValidationItem({ validation }: { validation: Validation }) {
  return (
    <li className="rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Badge variant={validation.passed ? "secondary" : "destructive"}>
          {validation.passed ? "Passed" : "Failed"}
        </Badge>
        <span className="font-medium">{validation.ruleName}</span>
      </div>
      {validation.ruleDescription && (
        <p className="mt-1 text-sm text-muted-foreground">
          {validation.ruleDescription}
        </p>
      )}
      {validation.violations.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {validation.violations.map((violation, i) => (
            <li key={i} className="font-mono text-red-600 dark:text-red-400">
              {violation.message}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function DiffTab({
  deploymentId,
  resultId,
  open,
  view,
}: {
  deploymentId: string;
  resultId: string;
  open: boolean;
  view: DiffView;
}) {
  const { theme } = useTheme();

  const diffQuery = trpc.deployment.plans.resultDiff.useQuery(
    { deploymentId, resultId },
    { enabled: open },
  );

  if (diffQuery.isLoading)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading diff...
      </div>
    );

  if (diffQuery.data == null)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No diff available
      </div>
    );

  return (
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
  );
}

export function PlanDiffDialog({
  deploymentId,
  resultId,
  title,
  open,
  initialTab = "diff",
  onOpenChange,
}: PlanDiffDialogProps) {
  const [tab, setTab] = useState<TopTab>(initialTab);
  const [view, setView] = useState<DiffView>("unified");

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col p-0 sm:max-w-[95vw]">
        <DialogHeader className="flex-row items-center justify-between border-b p-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <div className="flex items-center gap-4">
            {tab === "diff" && (
              <div className="flex items-center gap-2">
                <Switch
                  id="diff-split"
                  checked={view === "split"}
                  onCheckedChange={(checked) =>
                    setView(checked ? "split" : "unified")
                  }
                />
                <Label
                  htmlFor="diff-split"
                  className="text-xs text-muted-foreground"
                >
                  Split
                </Label>
              </div>
            )}
            <Tabs value={tab} onValueChange={(v) => setTab(v as TopTab)}>
              <TabsList>
                <TabsTrigger value="diff">Diff</TabsTrigger>
                <TabsTrigger value="validations">Validations</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          {resultId == null ? null : tab === "diff" ? (
            <DiffTab
              deploymentId={deploymentId}
              resultId={resultId}
              open={open}
              view={view}
            />
          ) : (
            <ValidationsTab
              deploymentId={deploymentId}
              resultId={resultId}
              open={open}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
