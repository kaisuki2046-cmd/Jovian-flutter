import { util } from 'iztro';
import { palaceSectorGeometry, ziweiBranches } from '../../control/ziwei-facts.ts';

const palaceOrder = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'];
const branches = new Set(ziweiBranches);
const stems = [...'甲乙丙丁戊己庚辛壬癸'];
const markers = ['禄', '权', '科', '忌'];
const transformations = new Map(stems.map((stem) => [stem, util.getMutagensByHeavenlyStem(stem)]));

const starMarkerPairs = new Set([...transformations.values()].flatMap((stars) =>
  stars.map((star, index) => `${star}:${markers[index]}`)));
const crossDirection = (direction) => direction === 'a_to_b' || direction === 'b_to_a';
const natalDirection = (direction, person) => (direction === 'self_a' && person === 'A') || (direction === 'self_b' && person === 'B');
const normalizePalace = (name) => name === '命' ? '命宫' : name;
const validPalace = (name) => palaceOrder.includes(normalizePalace(name));
const palaceStep = (source, target) => (palaceOrder.indexOf(normalizePalace(target))
  - palaceOrder.indexOf(normalizePalace(source)) + palaceOrder.length) % palaceOrder.length;
const branchStep = (source, target) => (ziweiBranches.indexOf(target)
  - ziweiBranches.indexOf(source) + ziweiBranches.length) % ziweiBranches.length;
const starLists = (...values) => values.every((value) => typeof value === 'string');

export function isConsistentZiweiFact({ rule, direction, facts }) {
  switch (rule) {
    case 'ziwei-cross-palace-sector': {
      const geometry = palaceSectorGeometry(facts.sourceBranch, facts.targetBranch);
      return crossDirection(direction) && validPalace(facts.source) && validPalace(facts.target)
        && Boolean(geometry && geometry.offset === facts.offset && geometry.relation === facts.relation)
        && starLists(facts.sourceMajorStars, facts.targetMajorStars, facts.sourceMinorStars, facts.targetMinorStars);
    }
    case 'ziwei-palace-by-branch':
      return crossDirection(direction) && (facts.source === '命宫' || facts.source === '身宫')
        && validPalace(facts.target) && branches.has(facts.branch);
    case 'ziwei-transformation-by-branch':
      return crossDirection(direction) && validPalace(facts.source) && validPalace(facts.target)
        && branches.has(facts.branch) && starMarkerPairs.has(`${facts.star}:${facts.marker}`);
    case 'ziwei-palace-stem-flight-overlay': {
      const markerIndex = markers.indexOf(facts.marker);
      return crossDirection(direction) && validPalace(facts.source) && validPalace(facts.nativeLanding)
        && validPalace(facts.target) && branches.has(facts.sourceBranch) && branches.has(facts.branch)
        && markerIndex >= 0 && transformations.has(facts.heavenlyStem)
        && transformations.get(facts.heavenlyStem)[markerIndex] === facts.star
        && branchStep(facts.sourceBranch, facts.branch) === palaceStep(facts.source, facts.nativeLanding);
    }
    case 'ziwei-natal-sector': {
      const geometry = palaceSectorGeometry(facts.sourceBranch, facts.targetBranch);
      return natalDirection(direction, facts.person) && validPalace(facts.source) && validPalace(facts.target)
        && Boolean(geometry && geometry.offset === facts.offset && geometry.relation === facts.relation)
        && geometry.offset === palaceStep(facts.source, facts.target)
        && starLists(facts.sourceStars, facts.targetStars)
        && (geometry.offset !== 0 || facts.sourceStars === facts.targetStars);
    }
    case 'ziwei-natal-palace':
      return natalDirection(direction, facts.person) && validPalace(facts.palace) && branches.has(facts.branch)
        && facts.lifePalace === Number(normalizePalace(facts.palace) === '命宫')
        && (facts.bodyPalace === 0 || facts.bodyPalace === 1)
        && starLists(facts.majorStars, facts.minorStars, facts.adjectiveStars)
        && (!Object.hasOwn(facts, 'starBrightness') || typeof facts.starBrightness === 'string');
    default:
      return true;
  }
}
