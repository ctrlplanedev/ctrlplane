"use client";

import type {
  DateFieldState,
  DateSegment as IDateSegment,
} from "react-stately";
import { useRef } from "react";
import { useDateSegment } from "react-aria";

import { cn } from "../index";

interface DateSegmentProps {
  segment: IDateSegment;
  state: DateFieldState;
  textxs?: boolean;
}

function DateSegment({ segment, state, textxs }: DateSegmentProps) {
  const ref = useRef(null);

  const {
    segmentProps: { ...segmentProps },
  } = useDateSegment(segment, state, ref);

  return (
    <div
      {...segmentProps}
      ref={ref}
      className={cn(
        "focus:rounded-[2px] focus:bg-accent focus:text-accent-foreground focus:outline-none",
        segment.type !== "literal" ? "px-[1px]" : "",
        segment.isPlaceholder ? "text-muted-foreground" : "",
        textxs ? "text-xs" : "text-sm",
      )}
      aria-label="date-segment-inner"
    >
      {segment.text}
    </div>
  );
}

export { DateSegment };
