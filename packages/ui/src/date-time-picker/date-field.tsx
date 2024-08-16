"use client";

import type { AriaDatePickerProps, DateValue } from "react-aria";
import { useRef } from "react";
import { createCalendar } from "@internationalized/date";
import { useDateField, useLocale } from "react-aria";
import { useDateFieldState } from "react-stately";

import { cn } from "@ctrlplane/ui";

import { DateSegment } from "./date-segment";

function DateField(props: AriaDatePickerProps<DateValue>) {
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
        "flex h-8 w-full items-center rounded-l-md border  border-r-0 bg-transparent px-2 py-1",
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
