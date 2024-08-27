import { GithubConfigFile } from "@ctrlplane/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";

export const GithubConfigFileSync: React.FC<{
  configFiles: GithubConfigFile[];
}> = ({ configFiles }) => {
  return (
    <Card className="rounded-md">
      <CardHeader className="space-y-2">
        <CardTitle>Sync Github Config File</CardTitle>
        <CardDescription>
          A{" "}
          <code className="rounded-md bg-neutral-800 p-1">ctrlplane.yaml</code>{" "}
          configuration file allows you to manage your Ctrlplane resources from
          github.
        </CardDescription>
      </CardHeader>

      <Separator />

      <CardContent className="p-4">
        {configFiles.map((configFile) => (
          <div key={configFile.id}>{configFile.path}</div>
        ))}
      </CardContent>
    </Card>
  );
};
