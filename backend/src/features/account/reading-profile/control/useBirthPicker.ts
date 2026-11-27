import { useState } from 'react';
import { firstPlace, locationOptions, locations, placeName, provinces, savedPlace } from '../model/birth-place';

const pad = (number: number) => String(number).padStart(2, '0');
const sequence = (first: number, last: number, unit: string) =>
  Array.from({ length: last - first + 1 }, (_, index) => ({
    value: String(index + first),
    label: index + first + unit,
  }));
const months = sequence(1, 12, '月');
const unknownTimePart = { value: '??', label: '未知' };
const hours = [...sequence(0, 23, '时'), unknownTimePart];
const minutes = [...sequence(0, 59, '分'), unknownTimePart];

function daysInMonth(year: number, month: number) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}


export function useDatePicker(initial: string, choose: (value: string) => void) {
  const [initialYear, initialMonth, initialDay] = (initial || '2000-01-01').split('-').map(Number);
  const [date, setDate] = useState({ year: initialYear, month: initialMonth, day: initialDay });
  const currentYear = new Date().getFullYear();
  const years = sequence(1900, currentYear, '年');
  if (initialYear < 1900) years.unshift({ value: String(initialYear), label: initialYear + '年' });
  if (initialYear > currentYear) years.push({ value: String(initialYear), label: initialYear + '年' });
  const maxDay = daysInMonth(date.year, date.month);

  function change(key: 'year' | 'month' | 'day', value: string) {
    setDate((previous) => {
      const updated = { ...previous, [key]: Number(value) };
      return { ...updated, day: Math.min(updated.day, daysInMonth(updated.year, updated.month)) };
    });
  }

  const confirm = () => choose([String(date.year).padStart(4, '0'), pad(date.month), pad(date.day)].join('-'));
  return { date, years, months, maxDay, days: sequence(1, maxDay, '日'), change, confirm };
}

export function useTimePicker(initial: string, choose: (value: string) => void) {
  const [initialHour, initialMinute] = (initial || '??:??').split(':');
  const [hour, setHour] = useState(initialHour === '??' ? initialHour : String(Number(initialHour)));
  const [minute, setMinute] = useState(initialMinute === '??' ? initialMinute : String(Number(initialMinute)));
  const format = (part: string) => part === '??' ? part : pad(Number(part));
  const confirm = () => choose(hour === '??' && minute === '??' ? '' : format(hour) + ':' + format(minute));
  return { hour, setHour, minute, setMinute, hours, minutes, confirm };
}

export function usePlacePicker(initial: string, choose: (value: string) => void) {
  const [existing] = useState(() => savedPlace(initial));
  const [place, setPlace] = useState(() => existing ?? firstPlace(provinces[0].value));
  const [manual, setManual] = useState(Boolean(initial && !existing));
  const [custom, setCustom] = useState(initial);
  const cities = locations[place.province];
  const districts = [{ value: '', label: '不填区县' }, ...locationOptions(cities[place.city])];

  const changeProvince = (province: string) => setPlace(firstPlace(province));
  const changeCity = (city: string) => setPlace((previous) => ({ ...previous, city, district: '' }));
  const changeDistrict = (district: string) => setPlace((previous) => ({ ...previous, district }));
  const toggleManual = () => setManual((current) => !current);
  const confirm = () => choose(manual ? custom.trim() : placeName(place));
  return { place, manual, custom, setCustom, provinces, cities: locationOptions(Object.keys(cities)), districts,
    changeProvince, changeCity, changeDistrict, toggleManual, canConfirm: !manual || Boolean(custom.trim()), confirm };
}
