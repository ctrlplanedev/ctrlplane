import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useWorkspace } from "~/components/WorkspaceProvider";

function useInviteUser() {
  const { workspace } = useWorkspace();
  const { id: workspaceId } = workspace;
  const { mutateAsync, isPending } = trpc.workspace.invite.useMutation();

  const handleInviteUser = (email: string) =>
    mutateAsync({ workspaceId, email }).then(() =>
      toast.success("User invited"),
    );

  return { handleInviteUser, isPending };
}

export default function MembersSettingsPage() {
  const [email, setEmail] = useState("");
  const { handleInviteUser, isPending } = useInviteUser();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Members</h1>
      <div className="flex items-center gap-2">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={() => handleInviteUser(email)} disabled={isPending}>
          Invite
        </Button>
      </div>
    </div>
  );
}
