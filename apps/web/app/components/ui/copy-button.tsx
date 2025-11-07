import React, { useState } from "react";
import { Copy } from "lucide-react";
import { useCopyToClipboard } from "react-use";

import { Button } from "./button";

export const CopyButton: React.FC<{ textToCopy: string }> = ({
  textToCopy,
}) => {
  const [copied, setCopied] = useState(false);
  const [, copyToClipboard] = useCopyToClipboard();

  const handleCopy = () => {
    copyToClipboard(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" onClick={handleCopy} type="button">
      {copied ? "Copied" : "Copy"}
      <Copy className="ml-2 h-4 w-4" />
    </Button>
  );
};
