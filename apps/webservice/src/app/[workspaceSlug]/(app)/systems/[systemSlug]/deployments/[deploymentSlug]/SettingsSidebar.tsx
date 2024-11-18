"use client";

import { Button } from "@ctrlplane/ui/button";

export const SidebarSection: React.FC<{
  children: React.ReactNode;
  id: string;
}> = ({ children, id }) => {
  const handleClick = () => {
    const element = document.getElementById(id);
    if (element == null) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Button
      variant="ghost"
      className="w-full justify-start"
      onClick={handleClick}
    >
      {children}
    </Button>
  );
};
