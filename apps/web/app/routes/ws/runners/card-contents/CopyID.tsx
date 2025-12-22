import { Copy } from "lucide-react";
import { useCopyToClipboard } from "react-use";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";

export function CopyIdSection({ id }: { id: string }) {
  const [, copyToClipboard] = useCopyToClipboard();
  const handleCopy = () => {
    copyToClipboard(id);
    toast.success("ID copied to clipboard");
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">ID</span>
      <Button
        variant="ghost"
        onClick={handleCopy}
        type="button"
        className="h-0 cursor-pointer p-0 text-xs font-normal underline-offset-2 hover:underline"
      >
        {id}
      </Button>
    </div>
  );
}
