export const PageHeader: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <header className="sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
      <div className="flex items-center gap-2 px-4">{children}</div>
    </header>
  );
};
