import React from "react";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { PolicyFormContextProvider } from "./_components/PolicyFormContext";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    policyId: string;
  }>;
}) {
  const { params, children } = props;
  const { policyId } = await params;

  const policy = await api.policy.byId({ policyId });
  if (policy == null) return notFound();

  return (
    <PolicyFormContextProvider policy={policy}>
      {children}
    </PolicyFormContextProvider>
  );
}
