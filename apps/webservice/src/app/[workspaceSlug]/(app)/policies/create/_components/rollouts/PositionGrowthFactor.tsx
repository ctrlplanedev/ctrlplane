import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

import { usePolicyContext } from "../PolicyContext";

export const PositionGrowthFactor: React.FC = () => {
  const { form } = usePolicyContext();

  const rolloutType = form.watch("environmentVersionRollout.rolloutType");
  const isExponential = rolloutType?.includes("exponential");

  if (!isExponential) return null;

  return (
    <FormField
      control={form.control}
      name="environmentVersionRollout.positionGrowthFactor"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Position Growth Factor</FormLabel>
          <FormDescription>
            Controls how strongly queue position influences delay — higher
            values result in a smoother, slower rollout curve.
          </FormDescription>
          <FormControl>
            <Input type="number" {...field} className="w-20" />
          </FormControl>
        </FormItem>
      )}
    />
  );
};
