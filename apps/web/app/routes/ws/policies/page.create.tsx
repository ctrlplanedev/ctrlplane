import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export function meta() {
  return [
    { title: "Create Policy - Ctrlplane" },
    {
      name: "description",
      content: "Create a new policy",
    },
  ];
}

export default function PageCreate() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Policy</CardTitle>
      </CardHeader>
      <CardContent>
        {/* TODO: Add policy creation form here */}
        <p className="text-muted-foreground">
          Policy creation form coming soon...
        </p>
      </CardContent>
    </Card>
  );
}
