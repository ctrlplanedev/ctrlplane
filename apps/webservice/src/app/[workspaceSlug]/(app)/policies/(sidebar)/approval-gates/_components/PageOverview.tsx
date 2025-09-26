import { IconShieldCheck } from "@tabler/icons-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

export const PageOverview: React.FC = () => (
  <Card className="mb-6">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <IconShieldCheck className="h-5 w-5 text-emerald-500" />
        <span>Approval Gates</span>
      </CardTitle>
      <CardDescription>
        Approval gates provide a critical security and governance layer for your
        deployment process
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      <p className="text-sm">
        Approval gates help ensure that deployments are reviewed and authorized
        by the right people before proceeding. They offer several key benefits:
      </p>
      <ul className="list-disc space-y-2 pl-5 text-sm">
        <li>
          <span className="font-medium">Quality Assurance</span>: Ensure code
          changes meet standards before deployment
        </li>
        <li>
          <span className="font-medium">Compliance</span>: Enforce regulatory
          requirements and internal governance policies
        </li>
        <li>
          <span className="font-medium">Risk Mitigation</span>: Prevent
          unauthorized or potentially harmful changes
        </li>
        <li>
          <span className="font-medium">Accountability</span>: Create clear
          ownership and responsibility for deployments
        </li>
      </ul>
    </CardContent>
  </Card>
);
