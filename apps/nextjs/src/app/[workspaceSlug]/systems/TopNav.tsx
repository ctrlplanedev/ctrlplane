import { cn } from "@ctrlplane/ui";

export const TopNav: React.FC<{
  classNames?: string;
  children: React.ReactNode;
}> = ({ children, classNames }) => {
  return (
    <div className={cn("flex items-center gap-2 border-b px-2", classNames)}>
      {children}
    </div>
  );
};
