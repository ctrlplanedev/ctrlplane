import React, { createContext, useContext, useState } from "react";

type DenyWindowContextType = {
  openEventId: string | null;
  setOpenEventId: (id: string | null) => void;
};

const DenyWindowContext = createContext<DenyWindowContextType | undefined>(
  undefined,
);

export const DenyWindowProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  return (
    <DenyWindowContext.Provider value={{ openEventId, setOpenEventId }}>
      {children}
    </DenyWindowContext.Provider>
  );
};

export const useDenyWindow = () => {
  const context = useContext(DenyWindowContext);
  if (context === undefined)
    throw new Error("useDenyWindow must be used within a DenyWindowProvider");
  return context;
};
