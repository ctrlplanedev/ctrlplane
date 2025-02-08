import Link from "next/link";

export const Tabs: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <div className="relative mb-6 mr-auto w-full border-b">{children}</div>
  );
};

export const TabsList: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return <div className="flex w-full justify-start">{children}</div>;
};

export const TabLink: React.FC<{
  href: string;
  isActive?: boolean;
  children: React.ReactNode;
}> = ({ href, isActive, children }) => {
  return (
    <Link
      href={href}
      data-state={isActive ? "active" : undefined}
      className="relative border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 text-sm text-muted-foreground shadow-none transition-none focus-visible:ring-0 data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
    >
      {children}
    </Link>
  );
};
