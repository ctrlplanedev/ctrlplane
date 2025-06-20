import { Button } from "@ctrlplane/ui/button";

import { usePolicyFormContext } from "../../_components/PolicyFormContext";

export const RolloutSubmit: React.FC = () => {
  const { form } = usePolicyFormContext();

  return (
    <Button
      type="submit"
      disabled={form.formState.isSubmitting || !form.formState.isDirty}
      className="w-fit"
    >
      Save
    </Button>
  );
};
