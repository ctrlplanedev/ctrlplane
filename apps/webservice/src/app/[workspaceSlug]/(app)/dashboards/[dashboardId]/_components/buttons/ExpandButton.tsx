import { IconEye } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export const ExpandButton: React.FC<{
  setIsExpanded: (isExpanded: boolean) => void;
}> = ({ setIsExpanded }) => (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setIsExpanded(true)}
    className="h-6 w-6"
  >
    <IconEye className="h-4 w-4" />
  </Button>
);
