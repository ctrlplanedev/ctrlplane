import type React from "react";
import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

import { trpc } from "~/api/trpc";

type Template =
  | "desired-release"
  | "deployment-selector"
  | "environment-selector"
  | "relationship-entity"
  | "relationship-rule"
  | "policy-summary"
  | "advanced";

const TEMPLATES: { value: Template; label: string; description: string }[] = [
  {
    value: "desired-release",
    label: "Desired Release",
    description:
      "Enqueue a desired release evaluation for a specific release target.",
  },
  {
    value: "deployment-selector",
    label: "Deployment Selector Eval",
    description: "Re-evaluate which resources match a deployment's selector.",
  },
  {
    value: "environment-selector",
    label: "Environment Selector Eval",
    description:
      "Re-evaluate which resources match an environment's selector.",
  },
  {
    value: "relationship-entity",
    label: "Relationship Eval (Entity)",
    description:
      "Re-evaluate relationships for a single resource, deployment, or environment.",
  },
  {
    value: "relationship-rule",
    label: "Relationship Eval (Rule)",
    description:
      "Re-evaluate relationships for all entities in the workspace. Useful after changing a rule.",
  },
  {
    value: "policy-summary",
    label: "Policy Summary Eval",
    description:
      "Re-evaluate policy summaries for an environment + version pair.",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "Manually specify all work item fields.",
  },
];

const WORK_ITEM_KINDS = [
  { value: "desired-release", label: "Desired Release" },
  {
    value: "environment-resource-selector-eval",
    label: "Environment Resource Selector Eval",
  },
  {
    value: "deployment-resource-selector-eval",
    label: "Deployment Resource Selector Eval",
  },
  { value: "relationship-eval", label: "Relationship Eval" },
] as const;

function useInvalidateAll() {
  const utils = trpc.useUtils();
  return () => {
    utils.reconcile.listWorkScopes.invalidate();
    utils.reconcile.stats.invalidate();
    utils.reconcile.chartData.invalidate();
  };
}

function DesiredReleaseForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const [deploymentId, setDeploymentId] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const invalidate = useInvalidateAll();
  const mutation = trpc.reconcile.triggerDesiredRelease.useMutation({
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ workspaceId, deploymentId, environmentId, resourceId });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dr-deploymentId">Deployment ID *</Label>
        <Input
          id="dr-deploymentId"
          placeholder="UUID of the deployment"
          value={deploymentId}
          onChange={(e) => setDeploymentId(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dr-environmentId">Environment ID *</Label>
        <Input
          id="dr-environmentId"
          placeholder="UUID of the environment"
          value={environmentId}
          onChange={(e) => setEnvironmentId(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dr-resourceId">Resource ID *</Label>
        <Input
          id="dr-resourceId"
          placeholder="UUID of the resource"
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          required
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Enqueuing…" : "Enqueue Desired Release"}
        </Button>
      </DialogFooter>
      {mutation.error && (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      )}
    </form>
  );
}

function DeploymentSelectorForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const [deploymentId, setDeploymentId] = useState("");
  const invalidate = useInvalidateAll();
  const mutation = trpc.reconcile.triggerDeploymentSelectorEval.useMutation({
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ workspaceId, deploymentId });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deploymentId">Deployment ID *</Label>
        <Input
          id="deploymentId"
          placeholder="UUID of the deployment"
          value={deploymentId}
          onChange={(e) => setDeploymentId(e.target.value)}
          required
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Triggering…" : "Trigger Eval"}
        </Button>
      </DialogFooter>
      {mutation.error && (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      )}
    </form>
  );
}

function EnvironmentSelectorForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const [environmentId, setEnvironmentId] = useState("");
  const invalidate = useInvalidateAll();
  const mutation = trpc.reconcile.triggerEnvironmentSelectorEval.useMutation({
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ workspaceId, environmentId });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="environmentId">Environment ID *</Label>
        <Input
          id="environmentId"
          placeholder="UUID of the environment"
          value={environmentId}
          onChange={(e) => setEnvironmentId(e.target.value)}
          required
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Triggering…" : "Trigger Eval"}
        </Button>
      </DialogFooter>
      {mutation.error && (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      )}
    </form>
  );
}

function RelationshipEntityForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const [entityType, setEntityType] = useState<string>("");
  const [entityId, setEntityId] = useState("");
  const invalidate = useInvalidateAll();
  const mutation = trpc.reconcile.triggerRelationshipEval.useMutation({
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({
          workspaceId,
          entityType: entityType as "resource" | "deployment" | "environment",
          entityId,
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entityType">Entity Type *</Label>
        <Select value={entityType} onValueChange={setEntityType} required>
          <SelectTrigger id="entityType">
            <SelectValue placeholder="Select entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resource">Resource</SelectItem>
            <SelectItem value="deployment">Deployment</SelectItem>
            <SelectItem value="environment">Environment</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entityId">Entity ID *</Label>
        <Input
          id="entityId"
          placeholder="UUID of the entity"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          required
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Triggering…" : "Trigger Eval"}
        </Button>
      </DialogFooter>
      {mutation.error && (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      )}
    </form>
  );
}

function RelationshipRuleForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const [ruleId, setRuleId] = useState("");
  const invalidate = useInvalidateAll();
  const mutation = trpc.reconcile.triggerRelationshipEvalForRule.useMutation({
    onSuccess: (data) => {
      invalidate();
      setResult(data.enqueued);
    },
  });
  const [result, setResult] = useState<number | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        mutation.mutate({ workspaceId, ruleId });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ruleId">Relationship Rule ID *</Label>
        <Input
          id="ruleId"
          placeholder="UUID of the relationship rule"
          value={ruleId}
          onChange={(e) => setRuleId(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          This will enqueue a relationship eval for every resource, deployment,
          and environment in the workspace.
        </p>
      </div>
      {result != null && (
        <p className="text-sm text-muted-foreground">
          Enqueued <span className="font-medium text-foreground">{result}</span>{" "}
          work items.{" "}
          <button
            type="button"
            className="text-primary underline"
            onClick={onDone}
          >
            Close
          </button>
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Triggering…" : "Trigger Eval for All Entities"}
        </Button>
      </DialogFooter>
      {mutation.error && (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      )}
    </form>
  );
}

function PolicySummaryForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const [environmentId, setEnvironmentId] = useState("");
  const [versionId, setVersionId] = useState("");
  const invalidate = useInvalidateAll();
  const mutation = trpc.reconcile.triggerPolicySummary.useMutation({
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ workspaceId, environmentId, versionId });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ps-environmentId">Environment ID *</Label>
        <Input
          id="ps-environmentId"
          placeholder="UUID of the environment"
          value={environmentId}
          onChange={(e) => setEnvironmentId(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ps-versionId">Version ID *</Label>
        <Input
          id="ps-versionId"
          placeholder="UUID of the deployment version"
          value={versionId}
          onChange={(e) => setVersionId(e.target.value)}
          required
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Triggering…" : "Trigger Eval"}
        </Button>
      </DialogFooter>
      {mutation.error && (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      )}
    </form>
  );
}

function AdvancedForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const defaultForm = {
    kind: "",
    scopeType: "",
    scopeId: "",
    priority: "100",
    notBefore: "",
    includePayload: false,
    payloadType: "",
    payloadKey: "",
    payloadJson: "{}",
  };

  const [form, setForm] = useState(defaultForm);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const invalidate = useInvalidateAll();

  const mutation = trpc.reconcile.create.useMutation({
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  const update = (field: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let parsedPayload: Record<string, unknown> = {};
    if (form.includePayload) {
      try {
        parsedPayload = JSON.parse(form.payloadJson) as Record<
          string,
          unknown
        >;
        setJsonError(null);
      } catch {
        setJsonError("Invalid JSON");
        return;
      }
    }

    mutation.mutate({
      workspaceId,
      kind: form.kind,
      scopeType: form.scopeType,
      scopeId: form.scopeId,
      priority: Number(form.priority),
      notBefore: form.notBefore ? new Date(form.notBefore) : undefined,
      payload: form.includePayload
        ? {
            payloadType: form.payloadType,
            payloadKey: form.payloadKey,
            payload: parsedPayload,
          }
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kind">Kind *</Label>
        <Select
          value={form.kind}
          onValueChange={(v) => update("kind", v)}
          required
        >
          <SelectTrigger id="kind">
            <SelectValue placeholder="Select a kind" />
          </SelectTrigger>
          <SelectContent>
            {WORK_ITEM_KINDS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scopeType">Scope Type</Label>
          <Input
            id="scopeType"
            placeholder="e.g. release_target"
            value={form.scopeType}
            onChange={(e) => update("scopeType", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scopeId">Scope ID</Label>
          <Input
            id="scopeId"
            placeholder="e.g. a UUID or key"
            value={form.scopeId}
            onChange={(e) => update("scopeId", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priority">Priority</Label>
          <Input
            id="priority"
            type="number"
            min={0}
            max={32767}
            value={form.priority}
            onChange={(e) => update("priority", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notBefore">Not Before</Label>
        <Input
          id="notBefore"
          type="datetime-local"
          value={form.notBefore}
          onChange={(e) => update("notBefore", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty for immediate processing.
        </p>
      </div>

      <div className="flex items-center gap-2 border-t pt-4">
        <input
          id="includePayload"
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={form.includePayload}
          onChange={(e) => update("includePayload", e.target.checked)}
        />
        <Label htmlFor="includePayload" className="font-normal">
          Include a payload
        </Label>
      </div>

      {form.includePayload && (
        <div className="flex flex-col gap-4 rounded-md border bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payloadType">Payload Type</Label>
              <Input
                id="payloadType"
                placeholder="e.g. trigger"
                value={form.payloadType}
                onChange={(e) => update("payloadType", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payloadKey">Payload Key</Label>
              <Input
                id="payloadKey"
                placeholder="e.g. unique-key"
                value={form.payloadKey}
                onChange={(e) => update("payloadKey", e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payloadJson">Payload JSON</Label>
            <Textarea
              id="payloadJson"
              className="min-h-[100px] font-mono text-xs"
              value={form.payloadJson}
              onChange={(e) => {
                update("payloadJson", e.target.value);
                setJsonError(null);
              }}
            />
            {jsonError && (
              <p className="text-xs text-destructive">{jsonError}</p>
            )}
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
      {mutation.error && (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      )}
    </form>
  );
}

export const CreateWorkItemDialog: React.FC<{
  workspaceId: string;
}> = ({ workspaceId }) => {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);

  const close = () => {
    setOpen(false);
    setTemplate(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTemplate(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-1.5 h-4 w-4" />
          Create Work Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {template ? "Create Work Item" : "Choose a Template"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? TEMPLATES.find((t) => t.value === template)?.description
              : "Select a pre-configured template or use the advanced form."}
          </DialogDescription>
        </DialogHeader>

        {!template && (
          <div className="flex flex-col gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTemplate(t.value)}
                className="flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.label}</span>
                  {t.value === "advanced" && (
                    <Badge variant="outline" className="text-xs">
                      Manual
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {t.description}
                </span>
              </button>
            ))}
          </div>
        )}

        {template === "desired-release" && (
          <DesiredReleaseForm workspaceId={workspaceId} onDone={close} />
        )}
        {template === "deployment-selector" && (
          <DeploymentSelectorForm workspaceId={workspaceId} onDone={close} />
        )}
        {template === "environment-selector" && (
          <EnvironmentSelectorForm workspaceId={workspaceId} onDone={close} />
        )}
        {template === "relationship-entity" && (
          <RelationshipEntityForm workspaceId={workspaceId} onDone={close} />
        )}
        {template === "relationship-rule" && (
          <RelationshipRuleForm workspaceId={workspaceId} onDone={close} />
        )}
        {template === "policy-summary" && (
          <PolicySummaryForm workspaceId={workspaceId} onDone={close} />
        )}
        {template === "advanced" && (
          <AdvancedForm workspaceId={workspaceId} onDone={close} />
        )}

        {template && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline hover:text-foreground"
            onClick={() => setTemplate(null)}
          >
            ← Back to templates
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
};
