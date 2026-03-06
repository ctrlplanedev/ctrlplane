import type React from "react";
import { useState } from "react";
import { PlusIcon } from "lucide-react";

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

const WORK_ITEM_KINDS = [
  { value: "desired-release", label: "Desired Release" },
  { value: "environment-resource-selector-eval", label: "Environment Resource Selector Eval" },
  { value: "deployment-resource-selector-eval", label: "Deployment Resource Selector Eval" },
  { value: "relationship-eval", label: "Relationship Eval" },
] as const;

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

export const CreateWorkItemDialog: React.FC<{
  workspaceId: string;
}> = ({ workspaceId }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const createMutation = trpc.reconcile.create.useMutation({
    onSuccess: () => {
      utils.reconcile.listWorkScopes.invalidate();
      utils.reconcile.stats.invalidate();
      utils.reconcile.chartData.invalidate();
      setOpen(false);
      setForm(defaultForm);
      setJsonError(null);
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

    createMutation.mutate({
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-1.5 h-4 w-4" />
          Create Work Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Work Item</DialogTitle>
          <DialogDescription>
            Manually enqueue a reconcile work scope and optional payload.
          </DialogDescription>
        </DialogHeader>

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
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>

          {createMutation.error && (
            <p className="text-sm text-destructive">
              {createMutation.error.message}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
