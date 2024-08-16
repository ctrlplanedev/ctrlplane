export const Section: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => <div className="flex flex-grow gap-6">{children}</div>;

export const SectionHeading: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="sticky left-0 top-0 w-[250px] shrink-0 text-xl font-semibold">
    {children}
  </div>
);

export const SectionContent: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="gap flex-grow space-y-6">{children}</div>
);

export const SectionContentHeading: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => <div className="mb-2 font-semibold">{children}</div>;

export const SectionContentBody: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => <div className="text-neutral-300">{children}</div>;
