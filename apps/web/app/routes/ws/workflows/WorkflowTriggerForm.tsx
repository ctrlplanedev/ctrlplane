import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";


type WorkflowTriggerFormProps = {
  workflowTemplate: WorkspaceEngine["schemas"]["WorkflowTemplate"];
};
export function WorkflowTriggerForm({ workflowTemplate }: WorkflowTriggerFormProps) {
  const form = useForm({
    resolver: zodResolver(z.object({
      inputs: z.record(z.string(), z.any()),
    })),
    defaultValues: {
      inputs: workflowTemplate.inputs.map((input) => {
        if (input.type === "string")
          return {
            name: input.name,
            value: input.default ?? "",
          };
        
        if (input.type === "number")
          return {
            name: input.name,
            value: input.default ?? 0,
          };
        
        if (input.type === "boolean")
          return {
            name: input.name,
            value: input.default ?? false,
          };

      }),
    },
  });
}