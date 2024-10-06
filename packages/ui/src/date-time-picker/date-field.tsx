"use client";

import type { AriaDatePickerProps, DateValue } from "react-aria";
import { useRef } from "react";
import { createCalendar } from "@internationalized/date";
import { useDateField, useLocale } from "react-aria";
import { useDateFieldState } from "react-stately";

import { cn } from "@ctrlplane/ui";

import { DateSegment } from "./date-segment";

function DateField(
  props: AriaDatePickerProps<DateValue> & { variant?: string },
) {
  const ref = useRef<HTMLDivElement | null>(null);

  const { locale } = useLocale();
  const state = useDateFieldState({
    ...props,
    locale,
    createCalendar,
  });
  const { fieldProps } = useDateField(props, state, ref);

  return (
    <div
      {...fieldProps}
      ref={ref}
      className={cn(
        "flex w-full items-center border border-r-0 bg-transparent px-2 py-1",
        props.variant === "filter"
          ? "h-9 text-muted-foreground"
          : "h-8 rounded-l-md",
        props.isDisabled ? "cursor-not-allowed opacity-50" : "",
      )}
    >
      {state.segments.map((segment, i) => (
        <DateSegment
          aria-label="date-segment"
          key={i}
          segment={segment}
          state={state}
          textxs
        />
      ))}
      {state.validationState === "invalid" && (
        <span aria-hidden="true">🚫</span>
      )}
    </div>
  );
}

export { DateField };
