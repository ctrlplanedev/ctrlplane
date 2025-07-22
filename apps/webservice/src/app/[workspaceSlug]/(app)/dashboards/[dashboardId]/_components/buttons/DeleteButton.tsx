import { IconTrash } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export const DeleteButton: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => (
  <Button variant="ghost" size="icon" onClick={onClick} className="h-6 w-6">
    <IconTrash className="h-4 w-4 text-red-500 hover:text-red-400" />
  </Button>
);
