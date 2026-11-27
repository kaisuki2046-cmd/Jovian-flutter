import divisions from '../places/china.json';

export const locations: Record<string, Record<string, string[]>> = divisions;
export const locationOptions = (names: string[]) => names.map((name) => ({ value: name, label: name }));
export const provinces = locationOptions(Object.keys(locations));
type Place = { province: string; city: string; district: string };
const groupNames = ['市辖区', '县', '省直辖县级行政区划', '自治区直辖县级行政区划'];

export function placeName({ province, city, district }: Place) {
  return [province, groupNames.includes(city) ? '' : city, district].filter(Boolean).join(' ');
}

export function savedPlace(value: string): Place | undefined {
  const [province, first, second] = value.split(' ');
  for (const [city, districts] of Object.entries(locations[province] ?? {})) {
    const district = (groupNames.includes(city) ? first : second) ?? '';
    const place = { province, city, district };
    if (placeName(place) === value && (!district || districts.includes(district))) return place;
  }
}

export function firstPlace(province: string): Place {
  return { province, city: Object.keys(locations[province])[0], district: '' };
}
