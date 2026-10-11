export type ScheduleParity = 'ЧБ' | 'ЗН';
export type WeekdayCode = 'пн' | 'вт' | 'ср' | 'чт' | 'пт' | 'сб' | 'нд';

const romanPairNumbers: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
};

const weekdayAliases: Array<[WeekdayCode, string[]]> = [
  ['пн', ['понеділок', 'понедельник', 'monday', 'пн', 'mon']],
  ['вт', ['вівторок', 'вторник', 'tuesday', 'вт', 'tue', 'tues']],
  ['ср', ['середа', 'среда', 'wednesday', 'ср', 'wed']],
  ['чт', ['четвер', 'thursday', 'чт', 'thu', 'thur', 'thurs']],
  ['пт', ["п'ятниця", 'пятниця', 'пятница', 'friday', 'пт', 'fri']],
  ['сб', ['субота', 'суббота', 'saturday', 'сб', 'sat']],
  ['нд', ['неділя', 'недiля', 'воскресенье', 'sunday', 'нд', 'sun']],
];

const allDayAliases = weekdayAliases.flatMap(([code, aliases]) =>
  aliases.map((alias) => ({ code, alias })).sort((a, b) => b.alias.length - a.alias.length),
);
const dayHeaderPattern = new RegExp(
  `^\\s*(?:[-•]\\s*)?(${allDayAliases.map(({ alias }) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[\\s:：,|([\\]–—-])\\s*(.*)$`,
  'iu',
);

function normalizeLabel(value: string) {
  return value.toLocaleLowerCase('uk-UA').normalize('NFC').replace(/[’ʼ']/g, "'");
}

function pairNumberFromToken(token: string) {
  const normalized = token.replace(/[Іі]/gu, 'I').toUpperCase();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return romanPairNumbers[normalized];
}

function parityFromLabel(value: string): ScheduleParity | undefined {
  const normalized = normalizeLabel(value.replace(/[\[\]()]/g, '').trim());
  if (normalized === 'чб') return 'ЧБ';
  if (normalized === 'зн') return 'ЗН';
  if (/^чисельник$/u.test(normalized)) return 'ЧБ';
  if (/^знаменн?ик$/u.test(normalized)) return 'ЗН';
  return undefined;
}

function parseDayHeader(line: string) {
  const match = line.match(dayHeaderPattern);
  if (!match) return undefined;
  const token = normalizeLabel(match[1] ?? '').replace(/\.$/u, '');
  const dayCode = allDayAliases.find(({ alias }) => alias === token)?.code;
  if (!dayCode) return undefined;

  let rest = (match[2] ?? '').trim();
  let parity: ScheduleParity | undefined;
  const bracketed = rest.match(/^(?:\[([^\]]+)\]|\(([^)]+)\))\s*:?\s*(.*)$/u);
  if (bracketed) {
    parity = parityFromLabel(bracketed[1] ?? bracketed[2] ?? '');
    rest = (bracketed[3] ?? '').trim();
  }
  const leadingParity = rest.match(/^(ЧБ|ЗН|чисельник|знаменн?ик)\b\s*:?\s*(.*)$/iu);
  if (!parity && leadingParity) {
    parity = parityFromLabel(leadingParity[1] ?? '');
    rest = (leadingParity[2] ?? '').trim();
  }

  return { dayCode, parity, inlineEntries: rest.replace(/^[:：–—-]\s*/u, '').trim() };
}

function isScheduleEntry(line: string) {
  return pairNumberFromScheduleLine(line) !== undefined
    || /^\s*(?:[-•]\s*)?(?:\d{1,2}):[0-5]\d\s*[-–—]\s*\d{1,2}:[0-5]\d\b/u.test(line);
}

function appendScheduleEntries(result: string[], line: string) {
  for (const entry of line.split(/\s*[;|]\s*/u).map((part) => part.trim()).filter(Boolean)) {
    if (isScheduleEntry(entry)) result.push(entry);
  }
}

export function weekdayCodeFromName(value: string): WeekdayCode | undefined {
  const normalized = normalizeLabel(value).replace(/\.$/u, '');
  return allDayAliases.find(({ alias }) => alias === normalized)?.code;
}

export function scheduleEntriesForDay(
  schedule: string,
  todayCode: WeekdayCode,
  parityMarker: ScheduleParity,
  dayLabel: string,
) {
  let inTodaySection = false;
  let hasDayLabel = false;
  const result: string[] = [];

  for (const rawLine of schedule.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = parseDayHeader(line);
    if (header) {
      inTodaySection = header.dayCode === todayCode && (!header.parity || header.parity === parityMarker);
      if (inTodaySection && !hasDayLabel) {
        result.push(`${dayLabel} [${parityMarker}]:`);
        hasDayLabel = true;
      }
      if (inTodaySection && header.inlineEntries) appendScheduleEntries(result, header.inlineEntries);
      continue;
    }

    if (!inTodaySection) continue;
    const entryParity = scheduleLineParity(line);
    if (entryParity && entryParity !== parityMarker) continue;
    appendScheduleEntries(result, line);
  }

  return result.join('\n');
}

export function bellScheduleTimes(bellSchedule: string) {
  const times = new Map<number, number>();
  for (const line of bellSchedule.split(/\r?\n/)) {
    const normalizedLine = line.replace(/[Іі]/gu, 'I');
    const match = normalizedLine.match(/^\s*(\d{1,2}|IV|V|I{1,3})\s*(?:пара(?=$|[^\p{L}])\s*)?[:.)-]\s*([01]?\d|2[0-3]):([0-5]\d)\s*[-–—]\s*([01]?\d|2[0-3]):([0-5]\d)/iu);
    if (!match) continue;
    const pairNumber = pairNumberFromToken(match[1] ?? '');
    if (pairNumber === undefined) continue;
    times.set(pairNumber, Number(match[2]) * 60 + Number(match[3]));
  }
  return times;
}

export function scheduleLineParity(line: string): ScheduleParity | undefined {
  const bracketedParity = line.match(/\[(ЧБ|ЗН)\]/iu)?.[1]?.toLocaleUpperCase('uk-UA');
  if (bracketedParity === 'ЧБ' || bracketedParity === 'ЗН') return bracketedParity;

  const wordParity = line.match(/(?:^|[^\p{L}])(чисельник|знаменн?ик)(?=$|[^\p{L}])/iu)?.[1];
  return wordParity ? parityFromLabel(wordParity) : undefined;
}

export function pairNumberFromScheduleLine(line: string) {
  const normalized = line
    .replace(/[Іі]/gu, 'I')
    .replace(/^\s*(?:[-•]\s*)?(?:\[(?:ЧБ|ЗН)\]\s*)?/iu, '');
  const tokenPattern = '(\\d{1,2}|IV|V|I{1,3})';
  const pairFirst = normalized.match(new RegExp(`^пара\\s*(?:№|#)?\\s*${tokenPattern}(?=$|[\\s:.)-])`, 'iu'));
  const numberFirst = normalized.match(new RegExp(`^(?:№|#)?\\s*${tokenPattern}\\s*(?:пара\\b|п\\.)`, 'iu'));
  const ordinal = normalized.match(new RegExp(`^(?:№|#)?\\s*${tokenPattern}(?:\\s*(?:я|а|й|st|nd|rd|th))?\\s*(?:[:.)-]|(?=\\s+\\p{L}))`, 'iu'));
  const token = pairFirst?.[1] ?? numberFirst?.[1] ?? ordinal?.[1];
  return token ? pairNumberFromToken(token) : undefined;
}
