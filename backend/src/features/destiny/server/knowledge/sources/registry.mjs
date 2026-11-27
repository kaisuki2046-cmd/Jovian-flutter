export const sources = {
  sanming: {
    id: 'sanming-tonghui-siku-v8', title: '三命通会', author: '万民英', edition: '钦定四库全书本 · 维基文库转录',
    editionId: 'siku-wikisource-juan-08', sourceType: 'classical_text', sourceLevel: 'primary',
    digitizationSource: '维基文库', textStatus: 'digital_transcription',
    url: 'https://zh.wikisource.org/zh-hans/三命通會_(四庫全書本)/卷08',
    rights: { status: 'historical_original', quotePolicy: 'locator_and_original_paraphrase' },
  },
  ziwei: {
    id: 'ziwei-doushu-quanshu-v2', title: '紫微斗数全书', author: '传本署名待核', edition: '维基文库分卷转录',
    editionId: 'ziwei-wikisource-juan-02', sourceType: 'classical_text', sourceLevel: 'primary',
    digitizationSource: '维基文库', textStatus: 'digital_transcription',
    url: 'https://zh.wikisource.org/zh-hans/紫微斗數全書/卷二',
    rights: { status: 'historical_original', quotePolicy: 'locator_and_original_paraphrase' },
  },
  leo: {
    id: 'alan-leo-astrology-for-all-1899', title: 'Astrology for All', author: 'Alan Leo', edition: '1899 年初版',
    editionId: 'leo-astrology-for-all-1899', publicationYear: 1899, sourceType: 'historical_book', sourceLevel: 'primary',
    digitizationSource: 'Umbriel 双扫描转录', textStatus: 'digital_transcription',
    url: 'https://umbrielastrology.com/library/alan-leo-moon-in-the-signs.html',
    rights: { status: 'historical_original', quotePolicy: 'locator_and_original_paraphrase' },
  },
};

export function sourcePassage(key, passageId, locator, overrides = {}) {
  return { ...sources[key], passageId, locator, accessedAt: '2026-11-16', ...overrides };
}
