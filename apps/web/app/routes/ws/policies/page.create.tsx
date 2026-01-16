import { Loader2Icon } from "lucide-react";
import { Link } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { useWorkspace } from "~/components/WorkspaceProvider";
import CelExpressionInput from "../_components/CelExpiressionInput";
import { usePolicyCreateForm } from "./_components/create/PolicyFormContext";

export function meta() {
  return [
    { title: "Create Policy - Ctrlplane" },
    {
      name: "description",
      content: "Create a new policy",
    },
  ];
}

export default function PageCreate() {
  const { workspace } = useWorkspace();
  const { form, isSubmitting } = usePolicyCreateForm();
  const anyApprovalEnabled = form.watch("anyApproval") != null;

  const handleApprovalToggle = (checked: boolean) => {
    if (checked) {
      form.setValue(
        "anyApproval",
        { minApprovals: 1 },
        { shouldDirty: true, shouldValidate: true },
      );
    } else {
      form.setValue("anyApproval", undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.clearErrors("anyApproval");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Policy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="text-lg font-medium">Basic information</h3>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Require approvals for production"
                      {...field}
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </FormControl>
                  <FormDescription>A short, descriptive policy name</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add context about when this policy should apply"
                      {...field}
                      disabled={isSubmitting}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(Number(event.target.value))
                      }
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Controls ordering when multiple policies apply
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border border-input p-4">
                  <div className="space-y-1">
                    <FormLabel>Enabled</FormLabel>
                    <FormDescription>
                      Enable this policy for evaluations immediately
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-medium">Target selectors</h3>

            <FormField
              control={form.control}
              name="target.deploymentSelector.cel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deployment selector</FormLabel>
                  <FormControl>
                    <div className="rounded-md border border-input p-2">
                      <CelExpressionInput
                        height="100px"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder='deployment.name.startsWith("api-")'
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    CEL expression to match deployments (use true for all)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target.environmentSelector.cel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Environment selector</FormLabel>
                  <FormControl>
                    <div className="rounded-md border border-input p-2">
                      <CelExpressionInput
                        height="100px"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder='environment.name == "production"'
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    CEL expression to match environments (use true for all)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target.resourceSelector.cel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource selector</FormLabel>
                  <FormControl>
                    <div className="rounded-md border border-input p-2">
                      <CelExpressionInput
                        height="100px"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder='resource.metadata.tier == "critical"'
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    CEL expression to match resources (use true for all)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-medium">Approvals</h3>

            <div className="flex items-center justify-between rounded-md border border-input p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  Require approvals
                </p>
                <p className="text-sm text-muted-foreground">
                  Add an approval rule before a deployment can proceed
                </p>
              </div>
              <Switch
                checked={anyApprovalEnabled}
                onCheckedChange={handleApprovalToggle}
                disabled={isSubmitting}
              />
            </div>

            {anyApprovalEnabled ? (
              <FormField
                control={form.control}
                name="anyApproval.minApprovals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum approvals</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(Number(event.target.value))
                        }
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      Required approvals before the policy allows deployment
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </section>

          <div className="flex items-center justify-end gap-3">
            <Button asChild variant="outline">
              <Link to={`/${workspace.slug}/policies`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Policy"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
