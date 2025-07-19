import { IconCopy } from "@tabler/icons-react";
import * as yaml from "js-yaml";
import { useCopyToClipboard } from "react-use";

import { Button } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";

import type { RuleForm } from "./formSchema";

const getFormattedForCopy = (form: RuleForm) => {
  const formData = form.getValues();

  const sourceMetadataEquals = formData.sourceMetadataEquals.map(
    ({ key, value }) => ({
      key,
      value,
    }),
  );
  const targetMetadataEquals = formData.targetMetadataEquals.map(
    ({ key, value }) => ({
      key,
      value,
    }),
  );

  return {
    name: formData.name ?? "",
    description: formData.description ?? "",
    reference: formData.reference,
    dependencyType: formData.dependencyType,
    dependencyDescription: formData.dependencyDescription ?? "",
    source: {
      kind: formData.sourceKind,
      version: formData.sourceVersion,
      metadataEquals:
        sourceMetadataEquals.length > 0 ? sourceMetadataEquals : undefined,
    },
    target:
      formData.targetKind == null && formData.targetVersion == null
        ? undefined
        : {
            kind: formData.targetKind,
            version: formData.targetVersion,
            metadataEquals:
              targetMetadataEquals.length > 0
                ? targetMetadataEquals
                : undefined,
          },
  };
};

const useCopyYamlToClipBoard = (form: RuleForm) => {
  const [_, copy] = useCopyToClipboard();
  const formattedForYaml = getFormattedForCopy(form);

  const yamlString = yaml.dump(formattedForYaml);

  return () => {
    copy(yamlString);
    toast.success("YAML copied to clipboard");
  };
};

export const CopyYamlButton: React.FC<{
  form: RuleForm;
}> = ({ form }) => {
  const copyYaml = useCopyYamlToClipBoard(form);
  return (
    <Button
      type="button"
      variant="outline"
      className="flex items-center gap-2"
      onClick={copyYaml}
    >
      <IconCopy className="h-4 w-4" />
      yaml
    </Button>
  );
};

const useCopyJsonToClipBoard = (form: RuleForm) => {
  const [_, copy] = useCopyToClipboard();
  const formattedForJson = getFormattedForCopy(form);
  const jsonString = JSON.stringify(formattedForJson, null, 2);

  return () => {
    copy(jsonString);
    toast.success("JSON copied to clipboard");
  };
};

export const CopyJsonButton: React.FC<{
  form: RuleForm;
}> = ({ form }) => {
  const copyJson = useCopyJsonToClipBoard(form);
  return (
    <Button
      type="button"
      variant="outline"
      className="flex items-center gap-2"
      onClick={copyJson}
    >
      <IconCopy className="h-4 w-4" />
      json
    </Button>
  );
};
