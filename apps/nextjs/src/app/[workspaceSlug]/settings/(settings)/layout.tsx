export default function AccountSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto max-w-6xl">
      <div className="m-10 mt-20 space-y-8">{children}</div>
    </div>
  );
}
