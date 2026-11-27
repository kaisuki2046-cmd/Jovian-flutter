type Star = { name: string; brightness?: string; mutagen?: string };
type Palace = {
  index: number; natalName: string; flowName: string; branch: string;
  natalStars: Star[]; movingStarIds?: string[]; oppositeIndex: number; triadIndices: number[];
  yearlySuiqianStar?: string; yearlyJiangqianStar?: string;
};
type Transformation = { star: string; kind: string; natalPalaceIndices: number[] };
export const ziweiConditionVersion = 'fortune-ziwei-palace-conditions-v1';
const unique = (values: string[]) => [...new Set(values)];
const movingAliases: Record<string, string> = {
  流马: '天马', 运马: '天马', 流禄: '禄存', 运禄: '禄存', 流羊: '擎羊', 运羊: '擎羊', 流陀: '陀罗', 运陀: '陀罗',
  流昌: '文昌', 运昌: '文昌', 流曲: '文曲', 运曲: '文曲', 流魁: '天魁', 运魁: '天魁', 流钺: '天钺', 运钺: '天钺',
  流鸾: '红鸾', 运鸾: '红鸾', 流喜: '天喜', 运喜: '天喜',
};
const allNames = (palace: Palace) => unique([...palace.natalStars.map(star => star.name),
  ...(palace.movingStarIds ?? []).map(name => movingAliases[name] ?? name)]);

// Each row refers to one concrete palace in one concrete flow layer. Queries
// cannot combine two stars from unrelated palaces into a same-palace result.
export function ziweiPalaceConditions(palace: Palace, palaces: Palace[], transformations: Transformation[]) {
  const opposite = palaces.find(row => row.index === palace.oppositeIndex);
  const triads = palaces.filter(row => palace.triadIndices.includes(row.index));
  const area = [palace.index, palace.oppositeIndex, ...palace.triadIndices];
  return {
    conditionVersion: ziweiConditionVersion, palaceIndex: palace.index, branch: palace.branch,
    flowName: palace.flowName, natalName: palace.natalName,
    natalStarNames: palace.natalStars.map(star => star.name),
    movingStarNames: palace.movingStarIds ?? [], localStarNames: allNames(palace),
    oppositeStarNames: opposite ? allNames(opposite) : undefined,
    triadStarNames: triads.length === 2 ? unique(triads.flatMap(allNames)) : undefined,
    surroundingStarNames: opposite && triads.length === 2 ? unique([palace, opposite, ...triads].flatMap(allNames)) : undefined,
    starBrightness: palace.natalStars.map(star => ({ name: star.name, brightness: star.brightness || undefined })),
    fallenStarNames: palace.natalStars.filter(star => star.brightness === '陷').map(star => star.name),
    brightStarNames: palace.natalStars.filter(star => ['庙', '旺', '得', '利'].includes(star.brightness ?? '')).map(star => star.name),
    localNatalTransformations: palace.natalStars.filter(star => star.mutagen).map(star => star.mutagen + ':' + star.name),
    localFlowTransformations: transformations.filter(row => row.natalPalaceIndices.includes(palace.index)).map(row => row.kind + ':' + row.star),
    surroundingFlowTransformations: transformations.filter(row => row.natalPalaceIndices.some(index => area.includes(index)))
      .map(row => row.kind + ':' + row.star),
    yearlySuiqianStar: palace.yearlySuiqianStar, yearlyJiangqianStar: palace.yearlyJiangqianStar,
  };
}
