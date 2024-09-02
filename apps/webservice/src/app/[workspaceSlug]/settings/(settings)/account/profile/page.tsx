export const metadata = { title: "Profile" };

export default function AccountSettingProfilePage() {
  return (
    <div className="container mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your Ctrlplane profile
        </p>
      </div>
      <div className="border-b" />
    </div>
  );
}
