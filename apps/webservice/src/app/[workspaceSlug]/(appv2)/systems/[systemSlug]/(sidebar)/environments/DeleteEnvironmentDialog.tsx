import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";

import { api } from "~/trpc/react";

type DeleteEnvironmentDialogProps = {
  environment: SCHEMA.Environment;
  children: React.ReactNode;
};

export const DeleteEnvironmentDialog: React.FC<
  DeleteEnvironmentDialogProps
> = ({ environment, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const deleteEnvironment = api.environment.delete.useMutation();

  const onDelete = () =>
    deleteEnvironment.mutateAsync(environment.id).then(() => router.refresh());

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Environment</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Are you sure you want to delete this environment? This action cannot
          be undone.
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
