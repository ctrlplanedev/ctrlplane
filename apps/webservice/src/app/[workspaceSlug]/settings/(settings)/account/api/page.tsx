import type { Metadata } from "next";

import { api } from "~/trpc/server";
import { CreateApiKey, ListApiKeys } from "./ApiSection";

export const metadata: Metadata = { title: "API Key Creation" };

export default async function AccountSettingApiPage() {
  const apiKeys = await api.user.apiKey.list();
  return (
    <>
      <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-120px)] overflow-auto">
        <div className="container mx-auto max-w-2xl space-y-8 py-8">
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

            <ListApiKeys apiKeys={apiKeys} />
            <CreateApiKey />
          </div>
        </div>
      </div>
    </>
  );
}
