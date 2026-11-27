export type PrintedLuckReading = {
  premise: string;
  periods: readonly { pillars: readonly string[]; assessment: string }[];
};

export function matchZpqzPrintedLuck<Id extends string>(
  cases: readonly { id: Id; name: string; matches: boolean | undefined }[],
  readings: Readonly<Partial<Record<Id, PrintedLuckReading>>>,
  luckPillar: string,
) {
  const printedLuck = cases.flatMap(({ id, name, matches }) => {
    const source = matches === true ? readings[id] : undefined;
    const period = source?.periods.find(row => row.pillars.includes(luckPillar));
    return source && period ? [{ id, name, premise: source.premise, assessment: period.assessment }] : [];
  });
  return { printedLuck, printedLuckCaseIds: printedLuck.map(row => row.id) };
}
