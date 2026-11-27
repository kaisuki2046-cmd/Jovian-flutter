import { birthPlaces as originalPlaces, type BirthPlace } from './birth-profile';
import { chinaPlaceRows } from './china-birth-places';

function placeKey({ region, city, district }: BirthPlace) {
  return [region, city, district ?? ''].join('/');
}

const originalChinaKeys = new Set(originalPlaces.filter(({ countryCode }) => countryCode === 'CN').map(placeKey));
const chinaPlaces: BirthPlace[] = chinaPlaceRows.map(([code, region, city, district, latitude, longitude, timeZone]) => ({
  id: 'CN-' + code,
  name: ['中国', region, region.startsWith(city) || city.endsWith('行政区划') ? '' : city, district].filter(Boolean).join(' · '),
  countryCode: 'CN',
  country: '中国',
  region,
  city,
  district: district || undefined,
  adminCode: code,
  latitude,
  longitude,
  timeZone,
})).filter((place) => !originalChinaKeys.has(placeKey(place)));

export const birthPlaceCatalog: readonly BirthPlace[] = [...originalPlaces, ...chinaPlaces];
const placesById = new Map(birthPlaceCatalog.map((place) => [place.id, place]));

export function findBirthPlace(id: string | undefined) {
  return id === undefined ? undefined : placesById.get(id);
}

export function resolveAccountBirthPlace(value: string) {
  const exact = birthPlaceCatalog.filter(({ name }) => name === value.trim());
  if (exact.length) return exact.length === 1 ? exact[0] : undefined;
  const compact = (name: string) => name.replace(/[\s·・/／,，]+/gu, '');
  const input = compact(value);
  if (!input) return undefined;
  const matches = birthPlaceCatalog.filter(({ country, region, city, district, name }) => {
    const fullPath = region.startsWith(city) || city.endsWith('行政区划')
      ? [region, district] : [region, city, district];
    const paths = district ? [fullPath, [region, district]] : [fullPath];
    return [name, ...paths.flatMap((path) =>
      [path.join(''), [country, ...path].join('')])].some((path) => compact(path) === input);
  });
  return matches.length === 1 ? matches[0] : undefined;
}
