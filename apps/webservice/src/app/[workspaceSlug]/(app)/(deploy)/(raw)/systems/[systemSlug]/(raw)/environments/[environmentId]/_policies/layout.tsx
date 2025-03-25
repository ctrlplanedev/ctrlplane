import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { PolicyTabs } from "./PolicyTabs";

export default async function PoliciesLayout(props: {
  children: React.ReactNode;
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;

  const environment = await api.environment.byId(environmentId);
  if (environment == null) notFound();

  return (
    <div className="container flex h-full flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">{`${environment.name}'s policies`}</h1>
      <PolicyTabs />
      <div className="h-full p-4">{props.children}</div>
    </div>
  );
}
