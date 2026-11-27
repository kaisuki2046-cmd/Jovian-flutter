import type { BirthDate, BirthTime } from '../model/birth-profile';

const minuteMs = 60_000;
const hoursMs = 60 * minuteMs;
const sampleIntervalMinutes = 30;
export const samplingVersion = 'known-time-parts-v2';
export const birthClockVersion = 'gregory-iana-intl-v1';

export function localClock(timeZone: string) {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    throw new Error('此设备无法读取出生地时区，请换一台支持该时区的设备。');
  }

  return (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, Number(value)]));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  };
}

export function birthInstants(date: BirthDate, time: BirthTime, timeZone: string) {
  const wallClock = localClock(timeZone);
  const localMidnight = Date.UTC(date.year, date.month - 1, date.day);

  // Probe both sides of the local day for historical UTC offsets, then round-trip
  // each wall-clock value. A DST gap has no match, a fold has two.
  const offsets = new Set<number>();
  for (let hour = -36; hour <= 36; hour += 6) {
    const instant = localMidnight + hour * hoursMs;
    offsets.add(wallClock(instant) - instant);
  }

  let localMinutes: number[];
  if (time.timeKnown) {
    localMinutes = [time.hour * 60 + time.minute];
  } else if (time.hour !== null) {
    const start = time.hour * 60;
    localMinutes = [...Array.from({ length: 12 }, (_, index) => start + index * 5), start + 59];
  } else if (time.minute !== null) {
    const minute = time.minute;
    localMinutes = Array.from({ length: 24 }, (_, hour) => hour * 60 + minute);
  } else {
    localMinutes = [...Array.from({ length: 1440 / sampleIntervalMinutes }, (_, index) => index * sampleIntervalMinutes), 1439];
  }
  const instants = localMinutes.flatMap((minute) => {
    const wallTime = localMidnight + minute * minuteMs;
    return [...offsets].map((offset) => wallTime - offset).filter((instant) => wallClock(instant) === wallTime);
  }).sort((a, b) => a - b);

  if (instants.length === 0) {
    throw new Error(time.hour !== null || time.minute !== null
      ? '出生地当天没有符合该输入的当地时刻，请修改时间。'
      : '出生地没有这个当地日期，请核对日期和地点。');
  }
  if (time.timeKnown && instants.length !== 1) {
    throw new Error('出生地当天发生时间回拨，该时刻出现了两次，无法仅凭填写的时分确定对应时刻。');
  }
  return instants;
}
