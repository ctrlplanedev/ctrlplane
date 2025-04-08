"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
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

import { IconDeviceFloppy, IconEdit, IconX } from "@tabler/icons-react";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { TimePicker } from "@ctrlplane/ui/datetime-picker";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";
import { DenyWindowProvider, useDenyWindow } from "./DenyWindowContext";

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

const EditDenyWindow: React.FC<{
  denyWindow: SCHEMA.PolicyRuleDenyWindow & { policy: SCHEMA.Policy };
  event: Event;
  setEditing: () => void;
}> = ({ denyWindow, event, setEditing }) => {
  const form = useForm({
    schema: z.object({
      start: z.date(),
      end: z.date(),
      recurrence: z.enum(["daily", "weekly", "monthly"]),
    }),
    defaultValues: {
      start: event.start,
      end: event.end,
      recurrence:
        Number(denyWindow.rrule.freq) === 1
          ? "monthly"
          : Number(denyWindow.rrule.freq) === 2
            ? "weekly"
            : "daily",
    },
  });

  const updateDenyWindow = api.policy.denyWindow.update.useMutation();
  const onSubmit = form.handleSubmit((data) => {
    console.log("data", data);
    // updateDenyWindow.mutate({
    //   id: denyWindow.id,
    //   data,
    // });
    // setEditing();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-1">
        <div className="flex items-center justify-between font-bold">
          <div>
            {denyWindow.policy.name === ""
              ? "Deny Window"
              : denyWindow.policy.name}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onSubmit}
              type="submit"
              className="h-4 w-4"
            >
              <IconDeviceFloppy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4"
              onClick={setEditing}
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <FormField
          control={form.control}
          name="start"
          render={({ field: { value, onChange } }) => (
            <FormItem className="flex flex-row items-center justify-between space-y-0">
              <FormLabel>Start</FormLabel>
              <FormControl>
                <TimePicker
                  granularity="minute"
                  showIcon={false}
                  inputClassName="h-6 w-8 text-sm p-1 border-neutral-600/30"
                  className="w-fit gap-1"
                  onChange={onChange}
                  date={new Date(value)}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="end"
          render={({ field: { value, onChange } }) => (
            <FormItem className="flex flex-row items-center justify-between space-y-0">
              <FormLabel className="mr-2">End</FormLabel>
              <FormControl>
                <TimePicker
                  granularity="minute"
                  showIcon={false}
                  inputClassName="h-6 w-8 text-sm p-1 border-neutral-600/30"
                  timePeriodPickerClassName="h-6 text-sm"
                  className="w-fit gap-1"
                  onChange={onChange}
                  date={new Date(value)}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="recurrence"
          render={({ field: { value, onChange } }) => (
            <FormItem className="flex flex-row items-center justify-between space-y-0">
              <FormLabel>Recurrence</FormLabel>
              <FormControl>
                <Select value={value} onValueChange={onChange}>
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};

const DenyWindowInfo: React.FC<{
  denyWindow: SCHEMA.PolicyRuleDenyWindow & { policy: SCHEMA.Policy };
  setEditing: () => void;
  fullStartString: string;
  endString: string;
}> = ({ denyWindow, setEditing, fullStartString, endString }) => (
  <div className="space-y-4">
    <div className="space-y-1">
      <div className="flex items-center justify-between font-bold">
        <div>
          {denyWindow.policy.name === ""
            ? "Deny Window"
            : denyWindow.policy.name}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={setEditing}
          className="h-4 w-4"
        >
          <IconEdit className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">
        <div>
          {fullStartString} - {endString}
        </div>
        <div>
          {Number(denyWindow.rrule.freq) === 1 && "Monthly"}
          {Number(denyWindow.rrule.freq) === 2 && "Weekly"}
          {Number(denyWindow.rrule.freq) === 3 && "Daily"}
        </div>
      </div>
    </div>
  </div>
);

const EventComponent: React.FC<{
  event: any;
  denyWindow: SCHEMA.PolicyRuleDenyWindow & { policy: SCHEMA.Policy };
}> = ({ event, denyWindow }) => {
  const [editing, setEditing] = useState<boolean>(false);
  const { openEventId, setOpenEventId } = useDenyWindow();
  const start = format(event.start, "h:mm a");
  const end = format(event.end, "h:mm a");
  const fullStartString = format(event.start, "EEEE, MMMM d, h:mm aa");
  return (
    <Popover open={openEventId === event.id}>
      <PopoverTrigger asChild>
        <div
          className="h-full w-full space-y-0 bg-primary/20 p-1 text-xs text-neutral-900"
          onClick={() => {
            setOpenEventId(event.id);
          }}
        >
          <div>
            {" "}
            {start} - {end}
          </div>
          <div>{event.title}</div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="center"
        className="bg-neutral-800 p-3"
      >
        {!editing && (
          <DenyWindowInfo
            denyWindow={denyWindow}
            setEditing={() => setEditing(true)}
            fullStartString={fullStartString}
            endString={end}
          />
        )}
        {editing && (
          <EditDenyWindow
            denyWindow={denyWindow}
            event={event as Event}
            setEditing={() => setEditing(false)}
          />
        )}
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
  return (
    <DenyWindowProvider>
      <CreateDenyRuleDialogContent workspaceId={workspaceId} />
    </DenyWindowProvider>
  );
};

const CreateDenyRuleDialogContent: React.FC<{ workspaceId: string }> = ({
  workspaceId,
}) => {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
  const now = useMemo(() => new Date(), []);
  const { openEventId, setOpenEventId } = useDenyWindow();
  console.log("openEventId", openEventId);

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

    const [denyWindowId] = e.id.split("|");
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

    const [denyWindowId] = e.id.split("|");
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
      onSelectSlot={(event) => {
        if (!openEventId) {
          handleEventCreate(event as EventCreate);
          return;
        }
        setOpenEventId(null);
        setEvents((prev) => prev.filter((event) => event.id !== "new"));
      }}
      onEventDrop={(event) => handleEventDrag(event as EventChange)}
      onEventResize={(event) => handleEventResize(event as EventChange)}
      style={{ height: 500 }}
      step={30}
      resizable={true}
      components={{
        event: (props) => {
          const event = props.event as Event;
          const [denyWindowId] = event.id.split("|");
          const denyWindow = denyWindows.find(
            (denyWindow) => denyWindow.id === denyWindowId,
          );
          if (denyWindow == null) return null;
          return <EventComponent {...props} denyWindow={denyWindow} />;
        },
      }}
    />
  );
};
