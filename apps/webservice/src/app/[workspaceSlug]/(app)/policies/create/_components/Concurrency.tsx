import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

import { usePolicyContext } from "./PolicyContext";

export const Concurrency: React.FC = () => {
  const { form } = usePolicyContext();
  return (
    <div className="space-y-6">
      <div className="max-w-xl space-y-1">
        <h2 className="text-lg font-semibold">Concurrency</h2>
        <p className="text-sm text-muted-foreground">
          Control the number of concurrent deployments
        </p>
      </div>

      <FormField
        control={form.control}
        name="concurrency"
        render={({ field: { value, onChange } }) => (
          <FormItem>
            <FormControl>
              <Input
                type="number"
                value={value ?? ""}
                onChange={(e) => {
                  const value = e.target.valueAsNumber;
                  const parsedValue = Number.isNaN(value) ? null : value;
                  onChange(parsedValue);
                }}
                className="w-20"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
