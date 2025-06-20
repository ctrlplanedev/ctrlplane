import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@ctrlplane/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { usePolicyContext } from "../PolicyContext";

export const RolloutTypeSelector: React.FC = () => {
  const { form } = usePolicyContext();

  return (
    <FormField
      control={form.control}
      name="environmentVersionRollout.rolloutType"
      render={({ field: { value, onChange } }) => (
        <FormItem>
          <FormLabel>Rollout Type</FormLabel>
          <FormDescription>
            Control the rate at which deployments are rolled out. Normalized
            rollouts complete all deployments within the time scale interval.
            Regular rollouts use the time scale interval for each individual
            deployment step.
          </FormDescription>
          <FormControl>
            <Select
              value={value ?? "no-rollout"}
              onValueChange={(value) => {
                if (value === "no-rollout") {
                  form.setValue("environmentVersionRollout", undefined);
                  return;
                }
                onChange(value);
              }}
              disabled={form.formState.isSubmitting}
            >
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Select Rollout Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-rollout">No rollout</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="exponential">Exponential</SelectItem>
                <SelectItem value="linear-normalized">
                  Linear Normalized
                </SelectItem>
                <SelectItem value="exponential-normalized">
                  Exponential Normalized
                </SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
        </FormItem>
      )}
    />
  );
};
