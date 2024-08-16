import React from "react";

import { cn } from "@ctrlplane/ui";

export const Heading: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="text-4xl font-semibold">{children}</div>;

export const HeadingBadge: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ children, className }) => (
  <div
    className={cn(
      "mb-4 bg-gradient-to-r bg-clip-text font-semibold uppercase tracking-widest text-transparent",
      className,
    )}
  >
    {children}
  </div>
);

export const HeadingDescription: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => <div className="mt-6 text-lg">{children}</div>;

export const Separator: React.FC = () => <div className="my-10 border-t" />;
