import type { UseFormReturn } from "react-hook-form";
import { Editor } from "@monaco-editor/react";
import yaml from "js-yaml";
import { z } from "zod";

import { useTheme } from "~/components/ThemeProvider";
import { FormField } from "~/components/ui/form";
import {
  deploymentJobAgentConfig,
  tfeJobAgentConfig,
} from "../deploymentJobAgentConfig";

const DEFAULT_CONFIG = {
  apiVersion: "v1",
  kind: "ConfigMap",
  metadata: {
    name: "{{.resource.name}}-terraform-cloud-config",
  },
  data: {
    "config.yaml": "{{.config.template}}",
  },
};

const formSchema = z.object({
  jobAgentId: z.string(),
  jobAgentConfig: z.record(z.string(), z.any()),
});

const tfeFormSchema = z.object({
  jobAgentId: z.string(),
  jobAgentConfig: tfeJobAgentConfig,
});

function getConfigString(config: { template?: string }): string {
  const template = config.template ?? "";
  if (template && template.trim()) return template;
  return yaml.dump(DEFAULT_CONFIG);
}

type Form = UseFormReturn<z.infer<typeof formSchema>>;
type TfeForm = UseFormReturn<z.infer<typeof tfeFormSchema>>;

type TerraformCloudConfigProps = { form: Form };

export function TerraformCloudConfig({ form }: TerraformCloudConfigProps) {
  const { theme } = useTheme();
  const tfeForm = form as unknown as TfeForm;

  return (
    <FormField
      control={tfeForm.control}
      name="jobAgentConfig"
      render={({ field: { value, onChange } }) => {
        const configString = getConfigString(value);

        const handleChange = (newValue: string) =>
          onChange({ type: "tfe", template: newValue });

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
