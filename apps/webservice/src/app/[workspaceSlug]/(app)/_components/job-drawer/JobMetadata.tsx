import { IconSparkles } from "@tabler/icons-react";

import { Input } from "@ctrlplane/ui/input";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import type { Job } from "./Job";
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";

type JobMetadataProps = {
  job: Job;
};

export const JobMetadata: React.FC<JobMetadataProps> = ({ job }) => {
  const sortedMetadata = job.job.metadata
    .map(({ key, value }) => [key, value] as [string, string])
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  const { search, setSearch, result } = useMatchSorterWithSearch(
    sortedMetadata,
    { keys: ["0", "1"] },
  );
  return (
    <div className="space-y-2">
      <span className="text-sm">Metadata ({sortedMetadata.length})</span>
      <div className="text-xs">
        <Input
          className="w-full rounded-b-none text-xs"
          placeholder="Search ..."
          aria-label="Search metadata"
          role="searchbox"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 max-h-[250px] overflow-auto rounded-b-lg border-x border-b p-1.5">
          {result.length === 0 && (
            <div className="text-center text-muted-foreground">
              No matching metadata found
            </div>
          )}
          {result.map(([key, value]) => (
            <div className="text-nowrap font-mono" key={key}>
              <span>
                {Object.values(ReservedMetadataKey).includes(
                  key as ReservedMetadataKey,
                ) && (
                  <IconSparkles className="inline-block h-3 w-3 text-yellow-300" />
                )}{" "}
              </span>
              <span className="text-red-400">{key}:</span>
              <span className="text-green-300"> {value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
