"use client";

import { Button } from "@ctrlplane/ui/button";

import { usePolicyContext } from "./PolicyContext";

export const PolicySubmit: React.FC = () => {
  const { form } = usePolicyContext();

  const onSubmit = form.handleSubmit((data) => {
    console.log(data);
  });

  return (
    <div className="ml-64 flex items-center gap-2">
      <Button variant="outline">Cancel</Button>
      <Button onClick={onSubmit}>Create Policy</Button>
    </div>
  );
};
