import { Input } from "@ctrlplane/ui/input";

import type { Job } from "./Job";
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";

type JobVariablesProps = {
  job: Job;
};

export const JobVariables: React.FC<JobVariablesProps> = ({ job }) => {
  const sortedVariables = job.job.variables
    .map((v) => {
      const key = String(v.key);
      const sensitive = v.sensitive ?? false;
      const value = sensitive ? "*****" : String(v.value);
      const searchableValue = sensitive ? "" : value;
      return [key, value, sensitive, searchableValue] as [
        string,
        string,
        boolean,
        string,
      ];
    })
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  const { search, setSearch, result } = useMatchSorterWithSearch(
    sortedVariables,
    { keys: ["0", "4"] },
  );

  return (
    <div className="space-y-2">
      <span className="text-sm">Variables ({sortedVariables.length})</span>
      <div className="text-xs">
        <Input
          className="w-full rounded-b-none text-xs"
          placeholder="Search ..."
          aria-label="Search metadata"
          role="searchbox"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 max-h-[250px] overflow-auto rounded-b-lg border-x border-b p-1.5">
          {result.length === 0 && (
            <div className="text-center text-muted-foreground">
              No matching variables found
            </div>
          )}
          {result.map(([key, value, sensitive]) => (
            <div className="text-nowrap font-mono" key={key}>
              <span className="text-red-400">{key}:</span>
              {sensitive && (
                <span className="text-muted-foreground"> {value}</span>
              )}
              {!sensitive && <span className="text-green-300"> {value}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
