"use client";

import { createContext, useContext, useState } from "react";

interface PanelContext {
  selectedNodeId: string | null;
  setSelectedNodeId: (string: string | null) => void;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (string: string | null) => void;
}

const panelContext = createContext<PanelContext>({
  selectedNodeId: null,
  selectedEdgeId: null,
  setSelectedEdgeId: () => {},
  setSelectedNodeId: () => {},
});

export const PanelProvider: React.FC<{
  defaultSelectedNodeId?: string;
  children?: React.ReactNode;
}> = ({ defaultSelectedNodeId, children }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    defaultSelectedNodeId ?? null,
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const selectEdge = (edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    if (edgeId != null) setSelectedNodeId(null);
  };

  const selectNode = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (nodeId != null) setSelectedEdgeId(null);
  };

  return (
    <panelContext.Provider
      value={{
        selectedNodeId,
        setSelectedNodeId: selectNode,
        selectedEdgeId,
        setSelectedEdgeId: selectEdge,
      }}
    >
      {children}
    </panelContext.Provider>
  );
};

export const usePanel = () => useContext(panelContext);
