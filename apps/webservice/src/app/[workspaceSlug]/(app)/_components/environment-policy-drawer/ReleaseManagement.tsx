import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@ctrlplane/ui/form";
import { RadioGroup, RadioGroupItem } from "@ctrlplane/ui/radio-group";

import type { PolicyFormSchema } from "./PolicyFormSchema";

export const ReleaseManagement: React.FC<{
  form: PolicyFormSchema;
}> = ({ form }) => (
  <div className="space-y-10 p-2">
    <div className="flex flex-col gap-1">
      <h1 className="text-lg font-medium">Release Management</h1>
      <span className="text-sm text-muted-foreground">
        Release management policies are concerned with how new and pending
        releases are handled within the deployment pipeline. These include
        defining sequencing rules, such as whether to cancel or await pending
        releases when a new release is triggered, ensuring that releases happen
        in a controlled and predictable manner without conflicts or disruptions.
      </span>
    </div>
    <FormField
      control={form.control}
      name="releaseSequencing"
      render={({ field: { value, onChange } }) => (
        <FormItem className="space-y-4">
          <div className="flex flex-col gap-1">
            <FormLabel>Release Sequencing</FormLabel>
            <FormDescription>
              Specify whether pending releases should be cancelled or awaited
              when a new release is triggered.
            </FormDescription>
          </div>
          <FormControl>
            <RadioGroup value={value} onValueChange={onChange}>
              <FormItem className="flex items-center space-x-3 space-y-0">
                <FormControl>
                  <RadioGroupItem value="wait" />
                </FormControl>
                <FormLabel className="flex items-center gap-2 font-normal">
                  Keep pending releases
                </FormLabel>
              </FormItem>
              <FormItem className="flex items-center space-x-3 space-y-0">
                <FormControl>
                  <RadioGroupItem value="cancel" />
                </FormControl>
                <FormLabel className="flex items-center gap-2 font-normal">
                  Cancel pending releases
                </FormLabel>
              </FormItem>
            </RadioGroup>
          </FormControl>
        </FormItem>
      )}
    />
  </div>
);
