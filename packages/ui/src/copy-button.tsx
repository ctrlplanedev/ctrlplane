import React, { useState } from "react";
import { TbCopy } from "react-icons/tb";
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
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  return (
    <Button variant="outline" onClick={handleCopy} type="button">
      {copied ? "Copied" : "Copy"}
      <TbCopy className="ml-2" />
    </Button>
  );
};
