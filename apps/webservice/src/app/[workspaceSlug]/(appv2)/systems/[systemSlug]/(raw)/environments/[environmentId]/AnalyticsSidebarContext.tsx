"use client";

import { createContext, useState } from "react";

type AnalyticsSidebarContext = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export const analyticsSidebarContext = createContext<AnalyticsSidebarContext>({
  isOpen: false,
  setIsOpen: () => {},
});

export const AnalyticsSidebarProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <analyticsSidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </analyticsSidebarContext.Provider>
  );
};
