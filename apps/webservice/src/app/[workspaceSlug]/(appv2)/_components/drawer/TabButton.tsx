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
        ? "bg-purple-500/10 text-purple-300 hover:bg-purple-500/10 hover:text-purple-300"
        : "text-muted-foreground",
    )}
  >
    {icon}
    {label}
  </Button>
);
