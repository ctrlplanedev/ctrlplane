import { api } from "~/trpc/server";
import { ReleaseTargetTile } from "./_components/ReleaseTargetTile";

type Params = Promise<{ resourceId: string }>;

export default async function DeploymentsPage(props: { params: Params }) {
  const { resourceId } = await props.params;

  const { items: releaseTargets } = await api.releaseTarget.list({
    resourceId,
  });

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {releaseTargets.map((rt) => (
        <ReleaseTargetTile key={rt.id} releaseTarget={rt} />
      ))}
    </div>
  );
}
