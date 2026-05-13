import { useState } from "react";
import { useParams } from "react-router";

import { trpc } from "~/api/trpc";
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
import { extractPlanSections, unionSectionNames } from "~/lib/plan-sections";

import { usePlanResultParam } from "../../_hooks/usePlanResultParam";
import { useDeployment } from "../DeploymentProvider";
import { DiffEditorPane } from "./plan-diff/DiffEditorPane";
import { SectionSelector } from "./plan-diff/SectionSelector";

type DiffView = "split" | "unified";

export function PlanDiffDialog() {
  const { deployment } = useDeployment();
  const { planId } = useParams<{ planId: string }>();
  const { resultId, tab, setTab, closeResult } = usePlanResultParam();
  const [view, setView] = useState<DiffView>("unified");
  const [selected, setSelected] = useState<string | undefined>();

  const resultsQuery = trpc.deployment.plans.results.useQuery(
    { deploymentId: deployment.id, planId: planId! },
    { enabled: !!planId && resultId != null },
  );
  const activeResult = resultsQuery.data?.items.find(
    (r) => r.resultId === resultId,
  );

  const diffQuery = trpc.deployment.plans.resultDiff.useQuery(
    { deploymentId: deployment.id, resultId: resultId ?? "" },
    { enabled: resultId != null && tab === "diff" },
  );

  const sectionNames = unionSectionNames(
    diffQuery.data?.current ?? "",
    diffQuery.data?.proposed ?? "",
  );
  const activeSection =
    selected != null && sectionNames.includes(selected)
      ? selected
      : sectionNames[0];

  const title = activeResult
    ? `${activeResult.environment.name} · ${activeResult.resource.name} · ${activeResult.agent.name}`
    : "";

  return (
    <Dialog
      open={resultId != null}
      onOpenChange={(o) => {
        if (!o) closeResult();
      }}
    >
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col p-0 sm:max-w-[95vw]">
        <DialogHeader className="flex-row items-center justify-between border-b p-4 pr-12">
          <div className="flex items-center gap-3">
            <DialogTitle>{title}</DialogTitle>
            <SectionSelector
              sections={sectionNames}
              value={activeSection}
              onChange={setSelected}
            />
          </div>
          <div className="flex items-center gap-4">
            {tab === "diff" && (
              <div className="flex items-center gap-2">
                <Switch
                  id="diff-split"
                  checked={view === "split"}
                  onCheckedChange={(c) => setView(c ? "split" : "unified")}
                />
                <Label
                  htmlFor="diff-split"
                  className="text-xs text-muted-foreground"
                >
                  Split
                </Label>
              </div>
            )}
            <Tabs value={tab} onValueChange={(v) => setTab(v as "diff" | "validations")}>
              <TabsList>
                <TabsTrigger value="diff">Diff</TabsTrigger>
                <TabsTrigger value="validations">Validations</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          {resultId != null && tab === "diff" && (
            <DiffBody
              isLoading={diffQuery.isLoading}
              data={diffQuery.data}
              activeSection={activeSection}
              view={view}
            />
          )}
          {resultId != null && tab === "validations" && (
            <ValidationsBody
              deploymentId={deployment.id}
              resultId={resultId}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DiffBody({
  isLoading,
  data,
  activeSection,
  view,
}: {
  isLoading: boolean;
  data: { current: string; proposed: string } | null | undefined;
  activeSection: string | undefined;
  view: DiffView;
}) {
  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading diff...
      </div>
    );
  if (data == null)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No diff available
      </div>
    );

  const currentSection = extractPlanSections(data.current).find(
    (s) => s.name === activeSection,
  );
  const proposedSection = extractPlanSections(data.proposed).find(
    (s) => s.name === activeSection,
  );
  return (
    <DiffEditorPane
      current={currentSection?.content ?? ""}
      proposed={proposedSection?.content ?? ""}
      view={view}
    />
  );
}

function ValidationsBody({
  deploymentId,
  resultId,
}: {
  deploymentId: string;
  resultId: string;
}) {
  const query = trpc.deployment.plans.resultValidations.useQuery({
    deploymentId,
    resultId,
  });

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
          <li key={v.id} className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Badge variant={v.passed ? "secondary" : "destructive"}>
                {v.passed ? "Passed" : "Failed"}
              </Badge>
              <span className="font-medium">{v.ruleName}</span>
            </div>
            {v.ruleDescription && (
              <p className="mt-1 text-sm text-muted-foreground">
                {v.ruleDescription}
              </p>
            )}
            {v.violations.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {v.violations.map((violation, i) => (
                  <li
                    key={i}
                    className="font-mono text-red-600 dark:text-red-400"
                  >
                    {violation.message}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
