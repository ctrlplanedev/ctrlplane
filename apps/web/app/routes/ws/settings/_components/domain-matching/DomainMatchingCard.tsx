import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { DomainMatchingFormData } from "./domainMatchingSchema";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Form } from "~/components/ui/form";
import { useWorkspace } from "~/components/WorkspaceProvider";
import {
  DomainField,
  RoleField,
  VerificationEmailField,
} from "./DomainMatchingFormFields";
import { domainMatchingSchema } from "./domainMatchingSchema";
import { DomainRuleRow } from "./DomainRuleRow";
import {
  useCreateDomainMatchingRule,
  useDeleteDomainMatchingRule,
  useDomainMatchingRules,
} from "./useDomainMatchingRules";

export function DomainMatchingCard() {
  const { workspace } = useWorkspace();
  const { id: workspaceId } = workspace;

  const { rules, roles } = useDomainMatchingRules(workspaceId);
  const createMutation = useCreateDomainMatchingRule(workspaceId);
  const deleteMutation = useDeleteDomainMatchingRule(workspaceId);

  const form = useForm<DomainMatchingFormData>({
    resolver: zodResolver(domainMatchingSchema),
    defaultValues: { domain: "", roleId: "", verificationEmail: "" },
  });

  const onSubmit = (data: DomainMatchingFormData) => {
    createMutation
      .mutateAsync({ workspaceId, ...data })
      .then(() => toast.success("Domain matching rule added queued"));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Domain Matching</CardTitle>
        <CardDescription>
          Automatically assign roles to users whose email matches a verified
          domain.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="flex items-end gap-2">
                <DomainField form={form} />
                <RoleField form={form} roles={roles} />
                <VerificationEmailField form={form} />
                <Button type="submit" disabled={createMutation.isPending}>
                  Add
                </Button>
              </div>
            </form>
          </Form>

          {rules != null && rules.length > 0 && (
            <div className="flex flex-col gap-2">
              {rules.map((rule) => (
                <DomainRuleRow
                  key={rule.id}
                  rule={rule}
                  onDelete={(id) => deleteMutation.mutate({ id, workspaceId })}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
