// Text lengths use JavaScript UTF-16 code units; transport sizes use UTF-8 bytes.
// These are acceptance ceilings, not targets for generated report length.
export const maxReportTextLength = 100_000;
export const maxReportSectionLength = 20_000;
export const maxReportDetailLength = 10_000;
export const maxReportBodyBytes = 16 * 1024 * 1024;
export const maxQuestionLength = 8_000;
