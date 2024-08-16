import murmurhash from "murmurhash";

const timeWindowPercent = (startDate: Date, duration: number) => {
  if (duration === 0) return 100;
  const now = Date.now();
  const start = startDate.getTime();
  const end = start + duration;

  if (now < start) return 0;
  if (now > end) return 100;

  return ((now - start) / duration) * 100;
};

export const isJobConfigInRolloutWindow = (
  session: string,
  startDate: Date,
  duration: number,
) => murmurhash.v3(session, 11) % 100 < timeWindowPercent(startDate, duration);

export const getRolloutDateForJobConfig = (
  session: string,
  startDate: Date,
  duration: number,
) =>
  new Date(
    startDate.getTime() + ((duration * murmurhash.v3(session, 11)) % 100) / 100,
  );
