import { cn } from "@ctrlplane/ui";

export const PageHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <header
      className={cn(
        "sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b bg-background  px-4",
        className,
      )}
    >
      {children}
    </header>
  );
};
