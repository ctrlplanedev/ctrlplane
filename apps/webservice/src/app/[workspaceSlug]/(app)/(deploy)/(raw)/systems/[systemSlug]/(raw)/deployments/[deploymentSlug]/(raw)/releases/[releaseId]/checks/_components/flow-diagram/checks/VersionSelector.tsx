import { api } from "~/trpc/react";
import { Failing, Loading, Passing } from "../StatusIcons";

export const VersionSelectorCheck: React.FC<{
  versionId: string;
  environmentId: string;
}> = ({ versionId, environmentId }) => {
  const { data, isLoading } = api.policy.evaluate.useQuery({
    environmentId,
    versionId,
  });

  const isPassingVersionSelector = Object.values(
    data?.rules.versionSelector ?? {},
  ).every((isPassing) => isPassing);

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
