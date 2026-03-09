import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Box,
  ChevronDown,
  Globe,
  Server,
} from "lucide-react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ResourceIcon } from "~/components/ui/resource-icon";
import { useWorkspace } from "~/components/WorkspaceProvider";

type Relation = {
  ruleId: string;
  relatedEntityName: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  ruleName: string;
  ruleReference: string;
  direction: string;
  resourceKind: string | null;
  resourceVersion: string | null;
  resourceIdentifier: string | null;
};

type RuleGroup = {
  ruleId: string;
  ruleName: string;
  ruleReference: string;
  incoming: Relation[];
  outgoing: Relation[];
};

function groupByRule(relations: Relation[]): RuleGroup[] {
  const map = new Map<string, RuleGroup>();
  for (const r of relations) {
    let group = map.get(r.ruleId);
    if (!group) {
      group = {
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        ruleReference: r.ruleReference,
        incoming: [],
        outgoing: [],
      };
      map.set(r.ruleId, group);
    }
    if (r.direction === "outgoing") group.outgoing.push(r);
    else group.incoming.push(r);
  }
  return Array.from(map.values());
}

function EntityTypeIcon({
  type,
  kind,
  version,
}: {
  type: string | null;
  kind?: string | null;
  version?: string | null;
}) {
  if (type === "resource" && kind && version)
    return <ResourceIcon kind={kind} version={version} className="h-4 w-4" />;
  if (type === "deployment") return <Box className="h-4 w-4" />;
  if (type === "environment") return <Globe className="h-4 w-4" />;
  return <Server className="h-4 w-4" />;
}

function EntityRow({
  relation,
  workspaceSlug,
}: {
  relation: Relation;
  workspaceSlug: string;
}) {
  const content = (
    <div className="flex items-center gap-2">
      <EntityTypeIcon
        type={relation.relatedEntityType}
        kind={relation.resourceKind}
        version={relation.resourceVersion}
      />
      <span className="font-medium">{relation.relatedEntityName}</span>
      <Badge variant="outline" className="text-[10px]">
        {relation.relatedEntityType}
      </Badge>
    </div>
  );

  if (
    relation.relatedEntityType === "resource" &&
    relation.resourceIdentifier != null
  ) {
    return (
      <Link
        to={`/${workspaceSlug}/resources/${encodeURIComponent(relation.resourceIdentifier)}`}
        className="flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-center rounded-md px-2 py-1.5 text-sm">
      {content}
    </div>
  );
}

function RuleCollapsible({
  group,
  workspaceSlug,
}: {
  group: RuleGroup;
  workspaceSlug: string;
}) {
  const total = group.incoming.length + group.outgoing.length;
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{group.ruleName}</span>
              <Badge variant="secondary" className="text-[10px]">
                {total}
              </Badge>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-1 py-1">
            {group.outgoing.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[11px] font-semibold text-muted-foreground">
                  <ArrowUpRight className="h-3 w-3 text-blue-500" />
                  Outgoing
                </div>
                {group.outgoing.map((r, i) => (
                  <EntityRow
                    key={`out-${r.relatedEntityId}-${i}`}
                    relation={r}
                    workspaceSlug={workspaceSlug}
                  />
                ))}
              </div>
            )}

            {group.incoming.length > 0 && (
              <div className={group.outgoing.length > 0 ? "mt-1" : ""}>
                <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[11px] font-semibold text-muted-foreground">
                  <ArrowDownLeft className="h-3 w-3 text-green-500" />
                  Incoming
                </div>
                {group.incoming.map((r, i) => (
                  <EntityRow
                    key={`in-${r.relatedEntityId}-${i}`}
                    relation={r}
                    workspaceSlug={workspaceSlug}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function ComputedRelationsSection() {
  const { workspace } = useWorkspace();

  const relations: Relation[] = [];

  if (relations.length === 0) return null;

  const groups = groupByRule(relations);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Computed Relationships
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {relations.length} relationship{relations.length !== 1 && "s"} across{" "}
          {groups.length} rule{groups.length !== 1 && "s"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {groups.map((group) => (
            <RuleCollapsible
              key={group.ruleId}
              group={group}
              workspaceSlug={workspace.slug}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
