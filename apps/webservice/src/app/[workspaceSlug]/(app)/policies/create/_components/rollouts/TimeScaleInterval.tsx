import { useState } from "react";
import ms from "ms";
import prettyMilliseconds from "pretty-ms";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { toast } from "@ctrlplane/ui/toast";

import { usePolicyContext } from "../PolicyContext";

const useReadableTimeScaleInterval = () => {
  const { form } = usePolicyContext();
  const rollout = form.watch("environmentVersionRollout");
  const timeScaleInterval = rollout?.timeScaleInterval;
  const [prettyString, setPrettyString] = useState<string>(
    timeScaleInterval == null
      ? ""
      : prettyMilliseconds(timeScaleInterval * 60_000),
  );

  const onChange = (prettyValue: string) => {
    if (prettyValue === "") {
      setPrettyString("");
      return;
    }

    const msValue = ms(prettyValue) as number | undefined;
    if (msValue == null || Number.isNaN(msValue)) {
      setPrettyString(prettyValue);
      toast.error("Invalid time scale interval");
      return;
    }

    setPrettyString(prettyValue);
    const minutes = msValue / 60_000;

    form.setValue("environmentVersionRollout.timeScaleInterval", minutes, {
      shouldDirty: true,
    });
  };

  return {
    value: prettyString,
    onChange,
  };
};

export const TimeScaleInterval: React.FC = () => {
  const { form } = usePolicyContext();
  const rollout = form.watch("environmentVersionRollout");
  const { value, onChange } = useReadableTimeScaleInterval();

  if (rollout == null) return null;

  return (
    <FormField
      control={form.control}
      name="environmentVersionRollout.timeScaleInterval"
      render={() => (
        <FormItem>
          <FormLabel>Time Scale Interval</FormLabel>
          <FormDescription>
            Defines the base time interval that each unit of rollout progression
            is scaled by — larger values stretch the deployment timeline.
          </FormDescription>
          <FormControl>
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-32"
              placeholder="1h, 10m, etc."
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
};
