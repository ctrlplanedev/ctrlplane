import type { Metadata } from "next";

import { CreateApiKey, ListApiKeys } from "./ApiSection";

export const metadata: Metadata = { title: "API Key Creation" };

export default function AccountSettingApiPage() {
  return (
    <div className="container mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">API</h1>
      </div>
      <div className="border-b" />
      <div className="space-y-6">
        <div>General</div>
        <div className="text-sm text-muted-foreground">
          You can create personal API keys for accessing Ctrlplane's API to
          build your own integration or hacks.
        </div>

        <ListApiKeys />
        <CreateApiKey />
      </div>
    </div>
  );
}
