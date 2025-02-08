import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../../SystemsBreadcrumb";
import { TopNav } from "../../../TopNav";

export default async function VariableSetPage(props: { params: Promise<any> }) {
  const params = await props.params;
  const variableSet = await api.variableSet.byId(params.variableSetId);

  if (!variableSet) notFound();

  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>
      <div className="container mx-auto p-8">
        <h1 className="mb-4 text-3xl font-bold">{variableSet.name}</h1>
        <p className="mb-6 text-muted-foreground">
          {variableSet.description ?? "No description provided"}
        </p>

        <h2 className="mb-4 text-2xl font-semibold">Variables</h2>
        <div className="grid grid-cols-2 gap-4">
          {variableSet.values.map((value) => (
            <div key={value.id} className="rounded-lg p-4">
              <h3 className="font-semibold">{value.key}</h3>
              <p className="">{value.value}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
