import { IconPlane } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export default function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full">
      <div className="flex items-center gap-2 p-4">
        <IconPlane className="h-10 w-10" />
        <div className="flex-grow" />
        <Button variant="ghost" className="text-muted-foreground">
          Contact
        </Button>
        <Button variant="outline">Sign up</Button>
      </div>
      {children}
    </div>
  );
}
