import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useResource } from "./ResourceProvider";

export function ResourceBasicInfo() {
  const { resource } = useResource();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-sm text-muted-foreground">ID</div>
            <div className="col-span-2 font-mono text-sm">{resource.id}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-sm text-muted-foreground">Identifier</div>
            <div className="col-span-2 font-mono text-sm">
              {resource.identifier}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-sm text-muted-foreground">Kind</div>
            <div className="col-span-2 font-mono text-sm">{resource.kind}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-sm text-muted-foreground">Version</div>
            <div className="col-span-2 font-mono text-sm">
              {resource.version}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="col-span-2 text-sm">
              {new Date(resource.createdAt).toLocaleString()}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-sm text-muted-foreground">Last Updated</div>
            <div className="col-span-2 text-sm">
              {resource.updatedAt != null
                ? new Date(resource.updatedAt).toLocaleString()
                : "-"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
