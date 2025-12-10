import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

export function MetadataSection({
  title,
  data,
  isOpen = true,
}: {
  title: string;
  data: Record<string, string | unknown>;
  isOpen?: boolean;
}) {
  const [open, setOpen] = useState(isOpen);

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-0.5 overflow-y-auto pt-0">
            {entries
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start gap-2 font-mono text-xs font-semibold"
                >
                  <span className="shrink-0 text-red-600">{key}:</span>
                  <pre className="text-green-700">
                    {typeof value === "string"
                      ? value
                      : JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
