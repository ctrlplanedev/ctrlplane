import type { RouterOutputs } from "@ctrlplane/trpc";
import { Editor } from "@monaco-editor/react";
import yaml from "js-yaml";

import type { Environment } from "./types";
import { useTheme } from "~/components/ThemeProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type VersionActionsPanelProps = {
  version: NonNullable<
    NonNullable<RouterOutputs["deployment"]["versions"]>["items"]
  >[number];
  environments: Environment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function parseJobAgentConfig(jobAgentConfig: Record<string, unknown>): string {
  try {
    return yaml.dump(jobAgentConfig);
  } catch (error) {
    try {
      return JSON.stringify(jobAgentConfig, null, 2);
    } catch (error) {
      return "";
    }
  }
}

export const VersionActionsPanel: React.FC<VersionActionsPanelProps> = ({
  version,
  open,
  onOpenChange,
}) => {
  const { jobAgentConfig } = version;
  const { theme } = useTheme();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="font-mono text-base">
            {version.tag}
          </DialogTitle>
          <DialogDescription className="text-[10px]">
            {/* Deployed to {totalOnVersion} of {totalResources} total resources
            across all environments */}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-4 pb-4">
          <div className="space-y-2.5 pt-4">
            {"template" in jobAgentConfig && (
              <Editor
                height="400px"
                options={{ readOnly: true }}
                language="plaintext"
                value={parseJobAgentConfig(jobAgentConfig)}
                theme={theme === "dark" ? "vs-dark" : "vs"}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
