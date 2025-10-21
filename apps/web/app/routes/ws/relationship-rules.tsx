import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";

export function meta() {
  return [
    { title: "Relationship Rules - Ctrlplane" },
    {
      name: "description",
      content: "Define how resources are related to each other",
    },
  ];
}

type Selector = { json?: unknown } | { cel?: string };

type PropertyMatcher = {
  fromProperty: string[];
  toProperty: string[];
  operator:
    | "equals"
    | "notEquals"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "regex";
};

type Matcher = { cel: string } | { properties: PropertyMatcher[] };

type RelationshipRule = {
  id: string;
  reference: string;
  name: string;
  description?: string;
  fromType: string;
  fromSelector?: Selector;
  toType: string;
  toSelector?: Selector;
  matcher: Matcher;
  relationshipType: string;
  metadata: Record<string, string>;
  workspaceId: string;
};

// Mock data - in production this would come from API
const mockRules: RelationshipRule[] = [
  {
    id: "1",
    workspaceId: "workspace-1",
    reference: "deployment-to-environment",
    name: "Deployment Environment Relationship",
    description: "Links deployments to their target environments",
    fromType: "deployment",
    toType: "environment",
    matcher: {
      properties: [
        {
          fromProperty: ["metadata", "environment-id"],
          toProperty: ["id"],
          operator: "equals",
        },
      ],
    },
    relationshipType: "deploys_to",
    metadata: {
      category: "orchestration",
    },
  },
  {
    id: "2",
    workspaceId: "workspace-1",
    reference: "environment-to-resources",
    name: "Environment Resources",
    description: "Maps environments to their associated resources",
    fromType: "environment",
    toType: "resource",
    fromSelector: {
      json: { type: "production" },
    },
    matcher: {
      properties: [
        {
          fromProperty: ["name"],
          toProperty: ["metadata", "environment"],
          operator: "equals",
        },
      ],
    },
    relationshipType: "contains",
    metadata: {
      category: "inventory",
    },
  },
  {
    id: "3",
    workspaceId: "workspace-1",
    reference: "service-dependencies",
    name: "Service Dependencies",
    description: "Tracks dependencies between microservices",
    fromType: "resource",
    toType: "resource",
    fromSelector: {
      json: { kind: "service" },
    },
    toSelector: {
      json: { kind: "database" },
    },
    matcher: {
      properties: [
        {
          fromProperty: ["metadata", "database-name"],
          toProperty: ["name"],
          operator: "equals",
        },
      ],
    },
    relationshipType: "depends_on",
    metadata: {
      category: "dependencies",
    },
  },
  {
    id: "4",
    workspaceId: "workspace-1",
    reference: "region-based-resources",
    name: "Regional Resource Grouping",
    description: "Groups resources by AWS region",
    fromType: "resource",
    toType: "resource",
    matcher: {
      properties: [
        {
          fromProperty: ["metadata", "region"],
          toProperty: ["metadata", "region"],
          operator: "equals",
        },
      ],
    },
    relationshipType: "same_region",
    metadata: {
      category: "topology",
      provider: "aws",
    },
  },
  {
    id: "5",
    workspaceId: "workspace-1",
    reference: "cel-matcher-example",
    name: "Complex CEL Matcher",
    description: "Uses CEL expression for complex matching logic",
    fromType: "deployment",
    toType: "resource",
    matcher: {
      cel: 'from.metadata.environment == to.metadata.environment && to.metadata.type == "database"',
    },
    relationshipType: "uses",
    metadata: {
      category: "advanced",
    },
  },
];

export default function RelationshipRules() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Relationship Rules</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
    </>
  );
}
