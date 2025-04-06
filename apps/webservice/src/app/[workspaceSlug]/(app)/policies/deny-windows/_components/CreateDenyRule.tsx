"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  differenceInMilliseconds,
  endOfDay,
  endOfWeek,
  format,
  getDay,
  parse,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";

import "./CreateDenyRule.css";

import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

type Event = {
  id: string;
  title: string;
  start: Date;
  end: Date;
};

const EventComponent: React.FC<{
  event: any;
  creatingDenyWindow: boolean;
  onClose: () => void;
}> = ({ event, creatingDenyWindow, onClose }) => {
  const [open, setOpen] = useState<boolean>(false);
  const start = format(event.start, "h:mm a");
  const end = format(event.end, "h:mm a");
  return (
    <Popover
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
        setOpen(open);
      }}
    >
      <PopoverTrigger asChild>
        <div
          className="h-full w-full space-y-0 bg-primary/20 p-1 text-xs text-neutral-900"
          onClick={(e) => {
            e.stopPropagation();
            console.log("clicked!", event);
          }}
        >
          <div>
            {" "}
            {start} - {end}
          </div>
          <div>{event.title}</div>
        </div>
      </PopoverTrigger>
      <PopoverContent side="right" align="center" className="bg-neutral-800">
        <div>TEST TEXT</div>
      </PopoverContent>
    </Popover>
  );
};

type EventChange = {
  event: object;
  start: Date;
  end: Date;
};

type EventCreate = {
  start: Date;
  end: Date;
};

export const CreateDenyRuleDialog: React.FC<{ workspaceId: string }> = ({
  workspaceId,
}) => {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
  const now = useMemo(() => new Date(), []);

  const [creatingDenyWindow, setCreatingDenyWindow] = useState<boolean>(false);

  const [currentRange, setCurrentRange] = useState<{
    start: Date;
    end: Date;
  }>({ start: startOfWeek(now), end: endOfWeek(now) });

  const denyWindowsQ = api.policy.denyWindow.list.byWorkspaceId.useQuery({
    workspaceId,
    start: currentRange.start,
    end: currentRange.end,
    timeZone,
  });

  const denyWindows = useMemo(
    () => denyWindowsQ.data ?? [],
    [denyWindowsQ.data],
  );
  const [events, setEvents] = useState<Event[]>(
    denyWindows.flatMap((denyWindow) => denyWindow.events),
  );

  useEffect(
    () => setEvents(denyWindows.flatMap((denyWindow) => denyWindow.events)),
    [denyWindows],
  );

  const resizeDenyWindow = api.policy.denyWindow.resize.useMutation();
  const dragDenyWindow = api.policy.denyWindow.drag.useMutation();
  const createDenyWindow = api.policy.denyWindow.createInCalendar.useMutation();

  const handleEventResize = (event: EventChange) => {
    const { start, end } = event;
    const e = event.event as {
      end: Date;
      start: Date;
      id: string;
    };

    const uuidRegex =
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-\d+$/i;
    const match = uuidRegex.exec(e.id);
    const denyWindowId = match ? match[1] : null;
    const denyWindow = denyWindows.find(
      (denyWindow) => denyWindow.id === denyWindowId,
    );
    const ev = denyWindow?.events.find((event) => event.id === e.id);
    if (denyWindow == null || ev == null) return;

    const dtstartOffset = differenceInMilliseconds(start, ev.start);
    const dtendOffset = differenceInMilliseconds(end, ev.end);

    const { id } = denyWindow;
    resizeDenyWindow.mutate({ windowId: id, dtstartOffset, dtendOffset });

    setEvents((prev) => {
      const newEvents = prev.filter((event) => event.id !== e.id);
      return [...newEvents, { ...ev, start: start, end: end }];
    });
  };

  const handleEventDrag = (event: EventChange) => {
    const { start, end } = event;
    const e = event.event as {
      end: Date;
      start: Date;
      id: string;
    };

    const uuidRegex =
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-\d+$/i;
    const match = uuidRegex.exec(e.id);
    const denyWindowId = match ? match[1] : null;
    const denyWindow = denyWindows.find(
      (denyWindow) => denyWindow.id === denyWindowId,
    );
    const ev = denyWindow?.events.find((event) => event.id === e.id);
    if (denyWindow == null || ev == null) return;

    const offset = differenceInMilliseconds(start, ev.start);
    const dayOfNewStart = getDay(start);

    const { id } = denyWindow;
    dragDenyWindow.mutate({ windowId: id, offset, day: dayOfNewStart });

    setEvents((prev) => {
      const newEvents = prev.filter((event) => event.id !== e.id);
      return [...newEvents, { ...ev, start: start, end: end }];
    });
  };

  const handleEventCreate = (event: EventCreate) => {
    console.log("creating deny window", event);
    const { start, end } = event;
    // // console.log("creating deny window", start, end);
    // // createDenyWindow.mutate({
    // //   policyId: "123",
    // //   start,
    //   end,
    //   timeZone,
    // });
    setEvents((prev) => [...prev, { id: "new", start, end, title: "" }]);
  };

  return (
    <DnDCalendar
      onRangeChange={(range) => {
        if (Array.isArray(range)) {
          const rangeStart = range.at(0);
          const rangeEnd = range.at(-1);

          if (rangeStart && rangeEnd)
            setCurrentRange({
              start: startOfDay(new Date(rangeStart)),
              end: endOfDay(new Date(rangeEnd)),
            });

          return;
        }
        const { start, end } = range;

        setCurrentRange({
          start: new Date(start),
          end: endOfDay(new Date(end)),
        });
      }}
      defaultView={Views.WEEK}
      localizer={localizer}
      events={events}
      resizableAccessor={() => true}
      draggableAccessor={() => true}
      selectable={true}
      onSelectSlot={(event) => handleEventCreate(event as EventCreate)}
      onEventDrop={(event) => handleEventDrag(event as EventChange)}
      onEventResize={(event) => handleEventResize(event as EventChange)}
      style={{ height: 500 }}
      step={30}
      resizable={true}
      components={{
        event: (props) => (
          <EventComponent {...props} creatingDenyWindow={creatingDenyWindow} />
        ),
      }}
    />
  );
};
