import { Badge } from "@ctrlplane/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

export const ApprovalTypesCard: React.FC = () => (
  <Card>
    <CardHeader>
      <CardTitle>Approval Types</CardTitle>
      <CardDescription>Available approval mechanisms</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">General Approval</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Requires a specified number of approvals from any workspace members.
          </p>
          <Badge variant="outline" className="bg-neutral-800/30">
            Simple and flexible
          </Badge>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Specific User Approval</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Requires approval from designated individuals in your workspace.
          </p>
          <Badge variant="outline" className="bg-neutral-800/30">
            Direct accountability
          </Badge>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Role-Based Approval</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Requires approval from users with specific roles or permissions.
          </p>
          <Badge variant="outline" className="bg-neutral-800/30">
            Organizational alignment
          </Badge>
        </div>
      </div>
    </CardContent>
  </Card>
);
