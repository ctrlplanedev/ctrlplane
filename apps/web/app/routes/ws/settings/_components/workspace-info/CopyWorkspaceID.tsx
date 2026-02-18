import { Copy } from "lucide-react";
import { useCopyToClipboard } from "react-use";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useWorkspace } from "~/components/WorkspaceProvider";

export function CopyWorkspaceID() {
  const { workspace } = useWorkspace();
  const { id } = workspace;
  const [, copyToClipboard] = useCopyToClipboard();

  const handleCopy = () => {
    copyToClipboard(id);
    toast.success("Workspace ID copied to clipboard");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">Workspace ID</label>
      <div className="flex items-center gap-2">
        <Input
          value={id}
          readOnly
          tabIndex={-1}
          className="pointer-events-none font-mono text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleCopy}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
