import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

export const GoogleResourceProviderConfig: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Resource Provider</CardTitle>
        <CardDescription>
          Scan common resources found in google cloud.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs defaultValue="self-hosted">
          <TabsList>
            <TabsTrigger value="managed">Managed</TabsTrigger>
            <TabsTrigger value="self-hosted">Self-hosted</TabsTrigger>
          </TabsList>

          <TabsContent value="managed" className="mt-6">
            <div>Currently we do not offer a managed hosted solution</div>
          </TabsContent>
          <TabsContent value="managed" className="mt-6">
            <div>Self-managed</div>

            <p>
              Self managed maybe a bit more complex to setup, but it gives you
              more control over the scanning process.
            </p>

            <p>
              Once the image is deployed it will register itself with the
              instance and start scanning for resources.
            </p>

            <table>
              <tbody>
                <tr>
                  <td>
                    <code>RESOURCE_PROVIDER_WORKSPACE</code>
                  </td>
                  <td>(required)</td>{" "}
                  <td>The workspace to register the resource provider</td>
                </tr>
              </tbody>
            </table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
