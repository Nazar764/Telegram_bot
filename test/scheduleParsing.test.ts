import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bellScheduleTimes,
  pairNumberFromScheduleLine,
  scheduleEntriesForDay,
  scheduleLineParity,
} from '../src/scheduleParsing.js';

test('reads Arabic and Roman pair numbers from bell schedules', () => {
  const times = bellScheduleTimes([
    'І пара: 08:30 – 09:50',
    'ІІ пара: 10:00 – 11:20',
    'ІІІ пара: 12:00 – 13:20',
    'IV пара: 13:30 – 14:50',
    'V пара: 15:00 – 16:20',
    '6: 16:30-17:50',
  ].join('\n'));

  assert.deepEqual([...times], [
    [1, 510],
    [2, 600],
    [3, 720],
    [4, 810],
    [5, 900],
    [6, 990],
  ]);
});

test('recognizes bracketed and written week-parity labels', () => {
  assert.equal(scheduleLineParity('1 пара Назва [ЧБ]'), 'ЧБ');
  assert.equal(scheduleLineParity('1 пара Назва [ЗН]'), 'ЗН');
  assert.equal(scheduleLineParity('4 пара Програмування Python - Знаменик'), 'ЗН');
  assert.equal(scheduleLineParity('4 пара Інша пара - Чисельник'), 'ЧБ');
  assert.equal(scheduleLineParity('1 пара Назва без позначки'), undefined);
});

test('selects lessons across Ukrainian, Russian, abbreviated, and English day headings', () => {
  const schedule = [
    'Група: КНК-43',
    'Понеділок:',
    '1 пара Український формат',
    'Tuesday: 1. Tuesday class',
    'СР',
    'ІІ. Скорочений формат',
    'Четвер — 1st English ordinal',
    'ПЯТНИЦА:',
    'Пара №2 — Russian pair-first format',
    'Monday:',
    '09:30–10:50 English time-first format',
  ].join('\n');

  assert.equal(
    scheduleEntriesForDay(schedule, 'пн', 'ЧБ', 'Понеділок'),
    'Понеділок [ЧБ]:\n1 пара Український формат\n09:30–10:50 English time-first format',
  );
  assert.equal(
    scheduleEntriesForDay(schedule, 'ср', 'ЗН', 'Середа'),
    'Середа [ЗН]:\nІІ. Скорочений формат',
  );
  assert.equal(
    scheduleEntriesForDay(schedule, 'пт', 'ЧБ', 'П’ятниця'),
    'П’ятниця [ЧБ]:\nПара №2 — Russian pair-first format',
  );
});

test('reads pair numbers written before or after the word pair and in Roman numerals', () => {
  assert.equal(pairNumberFromScheduleLine('1 пара Назва'), 1);
  assert.equal(pairNumberFromScheduleLine('Пара №2 — Назва'), 2);
  assert.equal(pairNumberFromScheduleLine('ІІІ. Назва'), 3);
  assert.equal(pairNumberFromScheduleLine('4-я пара Назва'), 4);
  assert.equal(pairNumberFromScheduleLine('V пара Назва'), 5);
  assert.equal(pairNumberFromScheduleLine('Назва пари без номера'), undefined);
});

test('filters both bracketed and written parity variants', () => {
  const schedule = [
    'Четвер:',
    '4 пара Python [ЗН]',
    '4 пара Web - Чисельник',
    '4 пара Cloud - Знаменик',
    '5 пара Без парності',
  ].join('\n');

  assert.equal(
    scheduleEntriesForDay(schedule, 'чт', 'ЧБ', 'Четвер'),
    'Четвер [ЧБ]:\n4 пара Web - Чисельник\n5 пара Без парності',
  );
  assert.equal(
    scheduleEntriesForDay(schedule, 'чт', 'ЗН', 'Четвер'),
    'Четвер [ЗН]:\n4 пара Python [ЗН]\n4 пара Cloud - Знаменик\n5 пара Без парності',
  );
});
