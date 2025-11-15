import type { UseFormReturn } from "react-hook-form";
import Editor from "@monaco-editor/react";
import yaml from "js-yaml";
import _ from "lodash";
import { z } from "zod";

import { useTheme } from "~/components/ThemeProvider";
import { FormField } from "~/components/ui/form";

// Example default ArgoCD Application YAML config shown if the config is empty
const DEFAULT_CONFIG = {
  apiVersion: "argoproj.io/v1alpha1",
  kind: "Application",
  metadata: {
    name: "{{.Resource.Name}}-application",
    namespace: "argocd",
    labels: {
      "app.kubernetes.io/name": "{{.Resource.Name}}",
      environment: "{{.Environment.Name}}",
      deployment: "{{.Deployment.Name}}",
      resource: "{{.Resource.Name}}",
    },
  },
  spec: {
    project: "default",
    source: {
      repoURL: "https://github.com/YOUR_ORG/YOUR_REPO.git",
      path: "YOUR_PATH_IN_REPO",
      targetRevision: "HEAD",
      helm: {
        releaseName: "{{.Resource.Name}}",
      },
    },
    destination: {
      name: "{{.Resource.Identifier}}",
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
  jobAgentConfig: z.record(z.any()),
});

function getParsedConfig(config: Record<string, any>): Record<string, any> {
  const template = config.template ?? "";
  const yamlParsed = yaml.load(template) as Record<string, any>;
  if ("spec" in yamlParsed) return yamlParsed;

  const jsonParsed = JSON.parse(template) as Record<string, any>;
  if ("spec" in jsonParsed) return jsonParsed;

  return DEFAULT_CONFIG;
}

type Form = UseFormReturn<z.infer<typeof formSchema>>;

type ArgoCDConfigProps = { form: Form };

export function ArgoCDConfig({ form }: ArgoCDConfigProps) {
  const { theme } = useTheme();
  console.log(theme);
  return (
    <FormField
      control={form.control}
      name="jobAgentConfig"
      render={({ field: { value, onChange } }) => {
        const config = getParsedConfig(value);
        const configString = yaml.dump(config);

        const handleChange = (newValue: string) =>
          onChange({ template: newValue });

        return (
          <div className="border">
            <Editor
              language="yaml"
              theme={theme === "dark" ? "vs-dark" : "vs-light"}
              options={{ minimap: { enabled: false } }}
              value={configString}
              onChange={(newValue) => handleChange(newValue ?? "")}
              height="400px"
            />
          </div>
        );
      }}
    />
  );
}
