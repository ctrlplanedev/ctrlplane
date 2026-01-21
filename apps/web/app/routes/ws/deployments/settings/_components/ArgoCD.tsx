import type { UseFormReturn } from "react-hook-form";
import Editor from "@monaco-editor/react";
import yaml from "js-yaml";
import { z } from "zod";

import { useTheme } from "~/components/ThemeProvider";
import { FormField } from "~/components/ui/form";
import {
  argoCdJobAgentConfig,
  deploymentJobAgentConfig,
} from "../deploymentJobAgentConfig";

// Example default ArgoCD Application YAML config shown if the config is empty
const DEFAULT_CONFIG = {
  apiVersion: "argoproj.io/v1alpha1",
  kind: "Application",
  metadata: {
    name: "{{.resource.name}}-application",
    namespace: "argocd",
    labels: {
      "app.kubernetes.io/name": "{{.resource.name}}",
      environment: "{{.environment.name}}",
      deployment: "{{.deployment.name}}",
      resource: "{{.resource.name}}",
    },
  },
  spec: {
    project: "default",
    source: {
      repoURL: "https://github.com/YOUR_ORG/YOUR_REPO.git",
      path: "YOUR_PATH_IN_REPO",
      targetRevision: "HEAD",
      helm: {
        releaseName: "{{.resource.name}}",
      },
    },
    destination: {
      name: "{{.resource.identifier}}",
      namespace: "default",
    },
    syncPolicy: {
      automated: {
        prune: true,
        selfHeal: true,
      },
      syncOptions: ["CreateNamespace=true"],
    },
  },
};

const formSchema = z.object({
  jobAgentId: z.string(),
  jobAgentConfig: deploymentJobAgentConfig,
});

const argoFormSchema = z.object({
  jobAgentId: z.string(),
  jobAgentConfig: argoCdJobAgentConfig,
});

function getConfigString(config: { template?: string }): string {
  const template = config.template ?? "";
  if (template && template.trim()) return template;
  return yaml.dump(DEFAULT_CONFIG);
}

type Form = UseFormReturn<z.infer<typeof formSchema>>;
type ArgoForm = UseFormReturn<z.infer<typeof argoFormSchema>>;

type ArgoCDConfigProps = { form: Form };

export function ArgoCDConfig({ form }: ArgoCDConfigProps) {
  const { theme } = useTheme();
  const argoForm = form as unknown as ArgoForm;

  return (
    <FormField
      control={argoForm.control}
      name="jobAgentConfig"
      render={({ field: { value, onChange } }) => {
        const configString = getConfigString(value);

        const handleChange = (newValue: string) =>
          onChange({ type: "argo-cd", template: newValue });

        return (
          <div className="border">
            <Editor
              language="plaintext"
              theme={theme === "dark" ? "vs-dark" : "vs"}
              options={{ minimap: { enabled: false }}}
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
