import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";

export const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <Button
    onClick={onClick}
    variant="ghost"
    className={cn(
      "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0 pr-3",
      active
        ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
        : "text-muted-foreground",
    )}
  >
    {icon}
    {label}
  </Button>
);
