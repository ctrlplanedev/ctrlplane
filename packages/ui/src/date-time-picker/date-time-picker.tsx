"use client";

import type { DateValue } from "react-aria";
import type { DatePickerStateOptions } from "react-stately";
import React, { useRef, useState } from "react";
import { IconCalendar } from "@tabler/icons-react";
import { useButton, useDatePicker, useInteractOutside } from "react-aria";
import { useDatePickerState } from "react-stately";

import { Button } from "../button";
import { cn } from "../index";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Calendar } from "./calendar";
import { DateField } from "./date-field";
import { TimeField } from "./time-field";
import { useForwardedRef } from "./useForwardedRef";

const DateTimePicker = React.forwardRef<
  HTMLDivElement,
  DatePickerStateOptions<DateValue> & { variant?: string }
>((props, forwardedRef) => {
  const ref = useForwardedRef(forwardedRef);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);

  const state = useDatePickerState(props);
  const {
    groupProps,
    fieldProps,
    buttonProps: _buttonProps,
    dialogProps,
    calendarProps,
  } = useDatePicker(props, state, ref);
  const { buttonProps } = useButton(_buttonProps, buttonRef);
  useInteractOutside({
    ref: contentRef,
    onInteractOutside: () => {
      setOpen(false);
    },
  });

  return (
    <div
      {...groupProps}
      ref={ref}
      className={cn(groupProps.className, "flex items-center rounded-md")}
    >
      <DateField {...fieldProps} variant={props.variant} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            {...buttonProps}
            variant="outline"
            className={cn(
              "rounded-l-none",
              props.variant === "filter" ? "h-9" : "h-8",
            )}
            disabled={props.isDisabled}
            onClick={() => setOpen(true)}
          >
            <IconCalendar className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent ref={contentRef} className="w-full" align="end">
          <div {...dialogProps} className="space-y-3">
            <Calendar {...calendarProps} />
            {state.hasTime && (
              <TimeField
                aria-label="time-field"
                value={state.timeValue}
                onChange={(value) => state.setTimeValue(value)}
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

DateTimePicker.displayName = "DateTimePicker";

export { DateTimePicker };
