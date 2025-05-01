import { api } from "~/trpc/react";
import { Failing, Loading, Passing } from "../StatusIcons";

export const VersionSelectorCheck: React.FC<{
  versionId: string;
  environmentId: string;
}> = ({ versionId, environmentId }) => {
  const { data, isLoading } =
    api.deployment.version.checks.versionSelector.useQuery({
      versionId,
      environmentId,
    });

  const isPassingVersionSelector = data ?? false;

  if (isLoading)
    return (
      <div className="flex items-center gap-2">
        <Loading /> Loading version selector status
      </div>
    );

  if (isPassingVersionSelector)
    return (
      <div className="flex items-center gap-2">
        <Passing /> Version selector passed
      </div>
    );

  return (
    <div className="flex items-center gap-2">
      <Failing /> Version selector failed
    </div>
  );
};
