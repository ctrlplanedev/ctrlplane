"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { MarkerType, useReactFlow } from "reactflow";
import colors from "tailwindcss/colors";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";

import { api } from "~/trpc/react";
import { usePanel } from "./SidepanelContext";

const markerEnd = {
  type: MarkerType.Arrow,
  color: colors.neutral[700],
};

const DeleteNodeDialogContext = createContext<{
  open: boolean;
  setOpen: (val: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

export const DeleteNodeDialogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <DeleteNodeDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DeleteNodeDialogContext.Provider>
  );
};

export const useDeleteNodeDialog = () => useContext(DeleteNodeDialogContext);

const useUpdateEdgesOnNodeDelete = () => {
  const { getNodes, getEdges, setEdges } = useReactFlow();
  const edges = getEdges();

  return (nodeId: string | null) => {
    const newEdges = edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );
    const orphanedNodes = getNodes().filter(
      (n) => !newEdges.some((e) => e.target === n.id),
    );
    newEdges.push(
      ...orphanedNodes.map((n) => ({
        id: `trigger-${n.id}`,
        source: "trigger",
        target: n.id,
        markerEnd,
      })),
    );

    setEdges(newEdges);
  };
};

export const DeleteNodeDialog: React.FC = () => {
  const { getNodes, setNodes } = useReactFlow();
  const { selectedNodeId, setSelectedNodeId } = usePanel();
  const selectedNode = getNodes().find((n) => n.id === selectedNodeId);

  const { open, setOpen } = useDeleteNodeDialog();

  const deleteEnv = api.environment.delete.useMutation();
  const deletePolicy = api.environment.policy.delete.useMutation();

  const updateEdgesOnNodeDelete = useUpdateEdgesOnNodeDelete();

  if (selectedNode == null) return null;

  const onDelete = async () => {
    if (selectedNode.type === "environment")
      await deleteEnv.mutateAsync(selectedNode.id);

    if (selectedNode.type === "policy")
      await deletePolicy.mutateAsync(selectedNode.id);

    setNodes((nodes) => nodes.filter((n) => n.id !== selectedNodeId));
    updateEdgesOnNodeDelete(selectedNodeId);
    setSelectedNodeId(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete {selectedNode.type ?? "node"} {selectedNode.data.name}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Are you sure you want to delete this {selectedNode.type ?? "node"}?
          You will have to recreate it from scratch.
        </DialogDescription>
        <DialogFooter>
          <Button
            variant="outline"
            className="border"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            className="border border-red-500 text-red-500 hover:border-red-400 hover:bg-red-400/20 hover:text-red-400"
            onClick={onDelete}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
