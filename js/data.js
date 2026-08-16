/**
 * Mazoezi — seed data
 *
 * Activities carry the units they are measured in, so the log form can
 * ask for distance only when distance means something.
 */

const ACTIVITIES = [
  { id: 'run', name: 'Run', tracksDistance: true, unit: 'km' },
  { id: 'ride', name: 'Ride', tracksDistance: true, unit: 'km' },
  { id: 'swim', name: 'Swim', tracksDistance: true, unit: 'km' },
  { id: 'lift', name: 'Strength', tracksDistance: false, unit: null },
  { id: 'football', name: 'Football', tracksDistance: false, unit: null },
  { id: 'walk', name: 'Walk', tracksDistance: true, unit: 'km' }
];

/** Default weekly target in minutes — the WHO baseline, rounded. */
const DEFAULT_TARGET = 150;

/** Deterministic pseudo-random source so the demo log is stable per load order. */
function seededRandom(seed) {
  let value = seed;
  return function next() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/**
 * Builds roughly nine weeks of history: a believable mix of runs, gym
 * sessions, and a weekly football game, with a couple of rest days a week.
 */
function seedSessions(today) {
  const rand = seededRandom(20260815);
  const sessions = [];
  const pattern = [
    { activity: 'run', minutes: [28, 52], distance: [4.5, 9.5], intensity: [3, 5] },
    { activity: 'lift', minutes: [40, 65], distance: null, intensity: [3, 4] },
    { activity: 'walk', minutes: [25, 45], distance: [2.5, 4.5], intensity: [1, 2] },
    { activity: 'football', minutes: [60, 90], distance: null, intensity: [4, 5] },
    { activity: 'ride', minutes: [35, 70], distance: [12, 26], intensity: [2, 4] }
  ];

  const pick = (range) => range[0] + rand() * (range[1] - range[0]);

  for (let back = 62; back >= 0; back--) {
    const date = new Date(today);
    date.setDate(date.getDate() - back);
    const weekday = date.getDay();

    // Sunday is a rest day; Wednesday is skipped every other week.
    if (weekday === 0) continue;
    if (weekday === 3 && back % 14 < 7) continue;

    const template =
      weekday === 6 ? pattern[3] : pattern[Math.floor(rand() * pattern.length)];

    sessions.push({
      id: `S-${back}-${weekday}`,
      date: date.toISOString().slice(0, 10),
      activity: template.activity,
      minutes: Math.round(pick(template.minutes)),
      distance: template.distance ? Number(pick(template.distance).toFixed(1)) : null,
      intensity: Math.round(pick(template.intensity)),
      note: ''
    });
  }
  return sessions;
}
