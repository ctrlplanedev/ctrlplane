import { Trash2 } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

type DomainRule = {
  id: string;
  domain: string;
  verified: boolean;
  roleName: string;
};

type DomainRuleRowProps = {
  rule: DomainRule;
  onDelete: (id: string) => void;
  isDeleting: boolean;
};

export function DomainRuleRow({ rule, onDelete, isDeleting }: DomainRuleRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-4 py-3">
      <span className="font-medium">{rule.domain}</span>
      <Badge variant={rule.verified ? "default" : "outline"}>
        {rule.verified ? "Verified" : "Unverified"}
      </Badge>
      <span className="grow text-sm text-muted-foreground">{rule.roleName}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(rule.id)}
        disabled={isDeleting}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
