import { Solar } from 'lunar-javascript';

// The fixed Asia/Shanghai calculation clock uses UTC+08:00, independently of the device timezone.
export function castCalendar(instant) {
  const date = new Date(instant + 8 * 3_600_000);
  const lunar = Solar.fromYmdHms(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()).getLunar();
  return {
    timezone: 'Asia/Shanghai',
    year: lunar.getYearInGanZhiExact(),
    month: lunar.getMonthInGanZhiExact(),
    day: lunar.getDayInGanZhiExact(),
  };
}
