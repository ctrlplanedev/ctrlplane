import React, { useState } from "react";
import { TbCopy } from "react-icons/tb";

import { Button } from "./button";

export const CopyButton: React.FC<{ textToCopy: string }> = ({
  textToCopy,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset the copied state after 2 seconds
  };

  return (
    <Button variant="outline" onClick={handleCopy} type="button">
      {copied ? "Copied!" : "Copy ID"}
      <TbCopy className="ml-2" />
    </Button>
  );
};
