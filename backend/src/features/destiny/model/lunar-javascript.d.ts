declare module 'lunar-javascript' {
  export const LunarUtil: {
    SHI_SHEN: Readonly<Record<string, string>>;
    NAYIN: Readonly<Partial<Record<string, string>>>;
    CHANG_SHENG_OFFSET: Readonly<Record<string, number>>;
    CHANG_SHENG: readonly string[];
    ZHI_HIDE_GAN: Readonly<Record<string, readonly string[]>>;
    getXun(ganZhi: string): string;
    getXunKong(ganZhi: string): string;
  };

  export const Solar: {
    fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): {
      getLunar(): {
        getMonth(): number;
        getDay(): number;
        getYearInGanZhiExact(): string;
        getMonthInGanZhiExact(): string;
        getDayInGanZhiExact(): string;
        getTimeInGanZhi(): string;
        getPrevJie(wholeDay?: boolean): { getSolar(): { toYmdHms(): string } } | null;
        getPrevQi(wholeDay?: boolean): { getName(): string } | null;
        getEightChar(): {
          getYun(gender: 0 | 1, sect: 2): {
            isForward(): boolean;
            getStartYear(): number;
            getStartMonth(): number;
            getStartDay(): number;
            getStartHour(): number;
            getStartSolar(): { toYmdHms(): string; nextYear(years: number): { toYmdHms(): string } };
            getDaYun(count: number): {
              getIndex(): number;
              getGanZhi(): string;
              getStartAge(): number;
              getEndAge(): number;
              getStartYear(): number;
              getEndYear(): number;
              getLiuNian(): {
                getYear(): number;
                getAge(): number;
                getGanZhi(): string;
                getLiuYue(): { getGanZhi(): string }[];
              }[];
            }[];
          };
        };
      };
    };
  };
}
