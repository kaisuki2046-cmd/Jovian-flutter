import { baziInteractions, baziNatalVoidSources } from './bazi-calculation';

const progressRestrictions: Readonly<Record<string, string>> = {
  丙子: '交神', 丁丑: '退神', 戊寅: '伏神',
  辛卯: '交神', 壬辰: '退神', 癸巳: '伏神',
  丙午: '交神', 丁未: '退神', 戊申: '伏神',
  辛酉: '交神', 壬戌: '退神', 癸亥: '伏神',
};

/** Review one actual Horse seat. A clash or combination elsewhere cannot count for this seat. */
export function smthHorseSeatReview(natal: { year: string; day: string }, seat: { position: string; pillar: string },
  pairs: ReturnType<typeof baziInteractions>['pairs']) {
  const voidSources = baziNatalVoidSources(natal, seat.pillar[1]);
  const contacts = pairs.filter(row => row.members.includes(seat.position));
  return {
    ...seat, voidSources,
    voidCombinations: voidSources.length ? contacts.filter(row => row.kind === '六合') : [],
    breakContacts: contacts.filter(row => row.kind === '六破'),
    progressRestriction: progressRestrictions[seat.pillar],
  };
}
