import type { UseFormReturn } from "react-hook-form";
import Editor from "@monaco-editor/react";
import yaml from "js-yaml";
import { z } from "zod";

import { useTheme } from "~/components/ThemeProvider";
import { FormField } from "~/components/ui/form";
import { argoWorkflowsJobAgentConfig } from "../deploymentJobAgentConfig";

const DEFAULT_CONFIG = {
  apiVersion: "argoproj.io/v1alpha1",
  kind: "Workflow",
  metadata: {
    generateName: "{{.deployment.slug}}-{{.environment.name}}-",
    labels: {
      "ctrlplane.dev/job-id": "{{.job.id}}",
      deployment: "{{.deployment.name}}",
      environment: "{{.environment.name}}",
    },
  },
  spec: {
    entrypoint: "run",
    arguments: {
      parameters: [
        { name: "job_id", value: "{{.job.id}}" },
        { name: "version_tag", value: "{{.version.tag}}" },
      ],
    },
    templates: [
      {
        name: "run",
        container: {
          image: "alpine:3.20",
          command: ["sh", "-c"],
          args: [
            "echo Deploying {{.deployment.name}} version {{.version.tag}} to {{.resource.name}}",
          ],
        },
      },
    ],
  },
};

const formSchema = z.object({
  jobAgentId: z.string(),
  jobAgentConfig: z.record(z.string(), z.any()),
});

const argoWorkflowsFormSchema = z.object({
  jobAgentId: z.string(),
  jobAgentConfig: argoWorkflowsJobAgentConfig,
});

function getConfigString(config: { template?: string }): string {
  const template = config.template ?? "";
  if (template && template.trim()) return template;
  return yaml.dump(DEFAULT_CONFIG);
}

type Form = UseFormReturn<z.infer<typeof formSchema>>;
type ArgoWorkflowsForm = UseFormReturn<z.infer<typeof argoWorkflowsFormSchema>>;

type ArgoWorkflowsConfigProps = { form: Form };

export function ArgoWorkflowsConfig({ form }: ArgoWorkflowsConfigProps) {
  const { theme } = useTheme();
  const argoForm = form as unknown as ArgoWorkflowsForm;

  return (
    <FormField
      control={argoForm.control}
      name="jobAgentConfig"
      render={({ field: { value, onChange } }) => {
        const configString = getConfigString(value);

        const handleChange = (newValue: string) =>
          onChange({ type: "argo-workflows", template: newValue });

        return (
          <div className="border">
            <Editor
              language="plaintext"
              theme={theme === "dark" ? "vs-dark" : "vs"}
              options={{ minimap: { enabled: false } }}
              value={configString}
              onChange={(newValue) => handleChange(newValue ?? "")}
              height="600px"
            />
          </div>
        );
      }}
    />
  );
}
