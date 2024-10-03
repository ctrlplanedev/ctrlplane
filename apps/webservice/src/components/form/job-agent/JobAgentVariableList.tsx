import { Input } from "@ctrlplane/ui/input";

import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";

const variableOptions = [
  { key: "release.version", description: "Release Version" },
  { key: "release.id", description: "Release ID" },
  { key: "target.name", description: "Target Name" },
  { key: "target.id", description: "Target ID" },
  { key: "environment.name", description: "Environment Name" },
  { key: "environment.id", description: "Environment" },
  { key: "system.name", description: "System Name" },
  { key: "system.id", description: "System ID" },
  { key: "workspace.name", description: "Workspace Name" },
  { key: "workspace.id", description: "Workspace ID" },
  { key: "job.id", description: "Job ID" },
  { key: "job.externalId", description: "Job Run ID" },
  { key: "job.status", description: "Job Status" },
  { key: "job.message", description: "Job Message" },
];
export const VariablesList: React.FC = () => {
  const { search, setSearch, result } = useMatchSorterWithSearch(
    variableOptions,
    { keys: ["key", "description"] },
  );
  return (
    <div>
      <div className="border-b p-6">
        <h3 className="font-semibold">Variables</h3>
      </div>

      <div className="border-b">
        <Input
          className="rounded-none border-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
        />
      </div>
      <div className="p-6">
        <table className="text-sm">
          <tbody>
            {result.map((variable) => (
              <tr key={variable.key}>
                <td className="pr-2">{variable.description}</td>
                <td className="font-mono">{variable.key}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
