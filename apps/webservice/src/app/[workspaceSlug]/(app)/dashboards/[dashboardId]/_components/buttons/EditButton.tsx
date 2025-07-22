import { IconPencil } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export const EditButton: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => (
  <Button variant="ghost" size="icon" onClick={onClick} className="h-6 w-6">
    <IconPencil className="h-4 w-4" />
  </Button>
);
