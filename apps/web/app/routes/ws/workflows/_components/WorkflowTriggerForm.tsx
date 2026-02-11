import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type { UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useWorkflowTemplate } from "./WorkflowTemplateProvider";

const formSchema = z.object({
  inputs: z.record(z.string(), z.any()),
});

function InputField({
  input,
  form,
}: {
  input: WorkspaceEngine["schemas"]["WorkflowInput"];
  form: UseFormReturn<z.infer<typeof formSchema>>;
}) {
  return (
    <FormField
      control={form.control}
      name={`inputs.${input.key}`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{input.key}</FormLabel>
          <FormControl>
            <>
              {input.type === "string" && <Input {...field} />}
              {input.type === "number" && <Input type="number" {...field} />}
              {input.type === "boolean" && (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            </>
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function WorkflowTriggerForm() {
  const { workspace } = useWorkspace();
  const { workflowTemplate } = useWorkflowTemplate();
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inputs: Object.fromEntries(
        workflowTemplate.inputs.map((input) => {
          if (input.type === "string") return [input.key, input.default ?? ""];
          if (input.type === "number") return [input.key, input.default ?? 0];
          if (input.type === "boolean")
            return [input.key, input.default ?? false];
          return [input.key, null];
        }),
      ),
    },
  });

  const createWorkflow = trpc.workflows.create.useMutation();

  const onSubmit = form.handleSubmit((data) =>
    createWorkflow
      .mutateAsync({
        workspaceId: workspace.id,
        workflowTemplateId: workflowTemplate.id,
        inputs: data.inputs,
      })
      .then(() => toast.success("Workflow triggered successfully"))
      .catch((error) => toast.error(error.message)),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        {workflowTemplate.inputs.map((input) => (
          <InputField key={input.key} input={input} form={form} />
        ))}

        <Button type="submit">Trigger Workflow</Button>
      </form>
    </Form>
  );
}
