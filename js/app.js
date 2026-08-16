/**
 * Mazoezi — application logic
 *
 * Sessions are the single source of truth. Everything on screen — the
 * chart, the streak, the personal bests, the goal ring — is computed from
 * that one array, so adding or deleting a session updates all of it.
 *
 * Sessions are persisted in localStorage so user-created workouts survive
 * a browser refresh.
 */

const STORAGE_KEY = 'mazoezi-sessions';

const state = {
  today: new Date(),
  sessions: [],
  filter: 'all',
  target: DEFAULT_TARGET,
  notice: null
};

const dayMs = 86400000;

/* ---------- helpers ---------- */

const activityById = (id) => ACTIVITIES.find((a) => a.id === id);
const isoDay = (d) => d.toISOString().slice(0, 10);

function parseDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / dayMs);
}

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Monday-based week start, which is how training weeks are usually cut. */
function startOfWeek(d) {
  const copy = startOfDay(d);
  const shift = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - shift);
  return copy;
}

function sortedSessions() {
  return [...state.sessions].sort((a, b) => b.date.localeCompare(a.date));
}

function filteredSessions() {
  return state.filter === 'all'
    ? sortedSessions()
    : sortedSessions().filter((s) => s.activity === state.filter);
}

/* ---------- persistence ---------- */

function loadSessions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const sessions = JSON.parse(saved);

      if (Array.isArray(sessions)) {
        return sessions;
      }
    }

    return seedSessions(state.today);
  } catch {
    return seedSessions(state.today);
  }
}

function saveSessions() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state.sessions)
    );
  } catch {
    // Continue working if browser storage is unavailable.
  }
}

/* ---------- analytics ---------- */

function weeklyBuckets(weeks = 8) {
  const thisWeek = startOfWeek(state.today);
  const buckets = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const minutes = state.sessions
      .filter((s) => {
        const d = parseDay(s.date);
        return d >= start && d < end;
      })
      .reduce((sum, s) => sum + s.minutes, 0);

    buckets.push({
      start,
      minutes,
      current: i === 0
    });
  }

  return buckets;
}

function minutesThisWeek() {
  const start = startOfWeek(state.today);

  return state.sessions
    .filter((s) => parseDay(s.date) >= start)
    .reduce((sum, s) => sum + s.minutes, 0);
}

/** Consecutive days ending today (or yesterday) that have at least one session. */
function currentStreak() {
  const days = new Set(state.sessions.map((s) => s.date));

  let streak = 0;
  const cursor = startOfDay(state.today);

  if (!days.has(isoDay(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (days.has(isoDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function personalBests() {
  const longest = state.sessions.reduce(
    (best, s) =>
      s.minutes > (best?.minutes ?? 0) ? s : best,
    null
  );

  const furthest = state.sessions
    .filter((s) => s.distance)
    .reduce(
      (best, s) =>
        s.distance > (best?.distance ?? 0) ? s : best,
      null
    );

  const biggestWeek = weeklyBuckets(12).reduce(
    (best, w) =>
      w.minutes > (best?.minutes ?? 0) ? w : best,
    null
  );

  return {
    longest,
    furthest,
    biggestWeek
  };
}

function last30Days() {
  const byDay = new Map();

  state.sessions.forEach((s) => {
    const entry =
      byDay.get(s.date) || {
        minutes: 0,
        intensity: 0
      };

    entry.minutes += s.minutes;
    entry.intensity = Math.max(
      entry.intensity,
      s.intensity
    );

    byDay.set(s.date, entry);
  });

  const cells = [];

  for (let back = 29; back >= 0; back--) {
    const d = new Date(state.today);
    d.setDate(d.getDate() - back);

    const key = isoDay(d);

    cells.push({
      date: d,
      key,
      ...(byDay.get(key) || {
        minutes: 0,
        intensity: 0
      })
    });
  }

  return cells;
}

/* ---------- actions ---------- */

function commit(notice) {
  state.notice = notice || null;

  // Persist the latest state before rendering.
  saveSessions();

  render();
}

function addSession(form) {
  const activity = form.activity.value;
  const minutes = Number(form.minutes.value);
  const date = form.date.value;
  const distanceRaw = form.distance.value;

  if (!date) {
    return commit({
      tone: 'warn',
      text: 'Pick a date for the session.'
    });
  }

  if (!minutes || minutes < 1) {
    return commit({
      tone: 'warn',
      text: 'Enter how many minutes the session lasted.'
    });
  }

  if (daysBetween(state.today, parseDay(date)) > 0) {
    return commit({
      tone: 'warn',
      text: 'That date is in the future. Log it once it happens.'
    });
  }

  state.sessions.push({
    id: `S-${Date.now()}`,
    date,
    activity,
    minutes,
    distance: distanceRaw
      ? Number(distanceRaw)
      : null,
    intensity: Number(form.intensity.value),
    note: form.note.value.trim()
  });

  form.minutes.value = '';
  form.distance.value = '';
  form.note.value = '';

  commit({
    tone: 'ok',
    text: `${activityById(activity).name} logged — ${minutes} min.`
  });
}

function deleteSession(id) {
  state.sessions = state.sessions.filter(
    (s) => s.id !== id
  );

  commit({
    tone: 'info',
    text: 'Session removed.'
  });
}

/* ---------- rendering ---------- */

function renderChart() {
  const buckets = weeklyBuckets(8);

  const peak = Math.max(
    ...buckets.map((b) => b.minutes),
    state.target,
    1
  );

  const w = 640;
  const h = 220;

  const pad = {
    left: 40,
    right: 12,
    top: 16,
    bottom: 30
  };

  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const barW =
    (plotW / buckets.length) * 0.62;

  const step =
    plotW / buckets.length;

  const targetY =
    pad.top +
    plotH -
    (state.target / peak) * plotH;

  const bars = buckets
    .map((b, i) => {
      const barH =
        (b.minutes / peak) * plotH;

      const x =
        pad.left +
        i * step +
        (step - barW) / 2;

      const y =
        pad.top +
        plotH -
        barH;

      const label =
        b.start.toLocaleDateString(
          'en-GB',
          {
            day: '2-digit',
            month: 'short'
          }
        );

      return `
        <g>
          <rect
            x="${x.toFixed(1)}"
            y="${y.toFixed(1)}"
            width="${barW.toFixed(1)}"
            height="${Math.max(barH, 1).toFixed(1)}"
            class="bar ${b.current ? 'bar--now' : ''}">
          </rect>

          <text
            x="${(x + barW / 2).toFixed(1)}"
            y="${(y - 6).toFixed(1)}"
            class="bar-value">
            ${b.minutes || ''}
          </text>

          <text
            x="${(x + barW / 2).toFixed(1)}"
            y="${h - 10}"
            class="axis-label">
            ${label}
          </text>
        </g>`;
    })
    .join('');

  document.getElementById('chart').innerHTML = `
    <svg
      viewBox="0 0 ${w} ${h}"
      role="img"
      aria-label="Weekly training minutes across the last eight weeks">

      <line
        x1="${pad.left}"
        x2="${w - pad.right}"
        y1="${targetY.toFixed(1)}"
        y2="${targetY.toFixed(1)}"
        class="target-line">
      </line>

      <text
        x="${pad.left - 6}"
        y="${(targetY + 4).toFixed(1)}"
        class="axis-label axis-label--end">
        ${state.target}
      </text>

      <line
        x1="${pad.left}"
        x2="${w - pad.right}"
        y1="${pad.top + plotH}"
        y2="${pad.top + plotH}"
        class="axis">
      </line>

      ${bars}
    </svg>`;
}

function renderHeatStrip() {
  const cells = last30Days()
    .map((c) => {
      const level =
        c.minutes === 0
          ? 0
          : Math.min(c.intensity, 5);

      const title =
        c.minutes === 0
          ? `${c.key}: rest`
          : `${c.key}: ${c.minutes} min, intensity ${c.intensity}`;

      return `
        <span
          class="heat heat--${level}"
          title="${title}">
        </span>`;
    })
    .join('');

  document.getElementById('heat').innerHTML =
    cells;
}

function renderGoal() {
  const done = minutesThisWeek();

  const pct = Math.min(
    Math.round(
      (done / state.target) * 100
    ),
    100
  );

  document.getElementById(
    'goal-fill'
  ).style.width = pct + '%';

  document.getElementById(
    'goal-done'
  ).textContent = done;

  document.getElementById(
    'goal-target'
  ).textContent = state.target;

  document.getElementById(
    'goal-pct'
  ).textContent = pct + '%';

  document.getElementById(
    'goal-note'
  ).textContent =
    done >= state.target
      ? 'Target met for the week.'
      : `${state.target - done} minutes to go.`;
}

function renderBests() {
  const {
    longest,
    furthest,
    biggestWeek
  } = personalBests();

  const rows = [
    [
      'Longest session',
      longest
        ? `${longest.minutes} min`
        : '—',
      longest
        ? `${activityById(longest.activity).name}, ${longest.date}`
        : 'No sessions yet'
    ],

    [
      'Furthest distance',
      furthest
        ? `${furthest.distance} km`
        : '—',
      furthest
        ? `${activityById(furthest.activity).name}, ${furthest.date}`
        : 'Log a run or ride'
    ],

    [
      'Biggest week',
      biggestWeek
        ? `${biggestWeek.minutes} min`
        : '—',
      biggestWeek
        ? `week of ${biggestWeek.start.toLocaleDateString(
            'en-GB',
            {
              day: '2-digit',
              month: 'short'
            }
          )}`
        : '—'
    ]
  ];

  document.getElementById('bests').innerHTML =
    rows
      .map(
        ([label, value, sub]) => `
          <div class="best">
            <span class="best__label">
              ${label}
            </span>

            <span class="best__value">
              ${value}
            </span>

            <span class="best__sub">
              ${sub}
            </span>
          </div>`
      )
      .join('');
}

function renderLog() {
  const rows =
    filteredSessions().slice(0, 40);

  const list =
    document.getElementById('log');

  if (!rows.length) {
    list.innerHTML = `
      <li class="log__empty">
        No sessions match that filter.
        Log one above, or switch back to every activity.
      </li>`;

    return;
  }

  list.innerHTML = rows
    .map((s) => {
      const activity =
        activityById(s.activity);

      const when =
        parseDay(s.date);

      const ago =
        daysBetween(
          when,
          state.today
        );

      const whenLabel =
        ago === 0
          ? 'Today'
          : ago === 1
          ? 'Yesterday'
          : `${ago} days ago`;

      return `
        <li class="entry">

          <span class="entry__day">
            <strong>
              ${when.toLocaleDateString(
                'en-GB',
                {
                  day: '2-digit'
                }
              )}
            </strong>

            ${when.toLocaleDateString(
              'en-GB',
              {
                month: 'short'
              }
            )}
          </span>

          <span class="entry__body">

            <span class="entry__activity">
              ${activity.name}
            </span>

            <span class="entry__meta">
              ${s.minutes} min
              ${
                s.distance
                  ? ` &middot; ${s.distance} ${activity.unit}`
                  : ''
              }
              &middot; intensity ${s.intensity}/5
              &middot; ${whenLabel}
            </span>

            ${
              s.note
                ? `<span class="entry__note">${s.note}</span>`
                : ''
            }

          </span>

          <button
            class="entry__remove"
            data-delete="${s.id}"
            aria-label="Delete session">
            &times;
          </button>

        </li>`;
    })
    .join('');
}

function renderTotals() {
  const total =
    state.sessions.reduce(
      (sum, s) =>
        sum + s.minutes,
      0
    );

  const distance =
    state.sessions.reduce(
      (sum, s) =>
        sum + (s.distance || 0),
      0
    );

  document.getElementById(
    't-sessions'
  ).textContent =
    state.sessions.length;

  document.getElementById(
    't-minutes'
  ).textContent =
    total;

  document.getElementById(
    't-distance'
  ).textContent =
    distance.toFixed(1);

  document.getElementById(
    't-streak'
  ).textContent =
    currentStreak();
}

function render() {
  renderTotals();
  renderChart();
  renderHeatStrip();
  renderGoal();
  renderBests();
  renderLog();

  const notice =
    document.getElementById('notice');

  notice.textContent =
    state.notice
      ? state.notice.text
      : '';

  notice.className =
    state.notice
      ? `notice notice--${state.notice.tone}`
      : 'notice';

  document
    .querySelectorAll('[data-filter]')
    .forEach((b) => {
      b.classList.toggle(
        'pill--on',
        b.dataset.filter === state.filter
      );
    });
}

/* ---------- wiring ---------- */

function syncDistanceField() {
  const activity =
    activityById(
      document.getElementById(
        'activity'
      ).value
    );

  const wrap =
    document.getElementById(
      'distance-wrap'
    );

  wrap.hidden =
    !activity.tracksDistance;

  if (!activity.tracksDistance) {
    document.getElementById(
      'distance'
    ).value = '';
  }
}

function init() {
  // Load existing sessions from localStorage.
  // New users receive the original sample sessions.
  state.sessions = loadSessions();

  document.getElementById(
    'activity'
  ).innerHTML =
    ACTIVITIES.map(
      (a) =>
        `<option value="${a.id}">${a.name}</option>`
    ).join('');

  document.getElementById(
    'filters'
  ).innerHTML = [
    {
      id: 'all',
      name: 'Everything'
    },
    ...ACTIVITIES
  ]
    .map(
      (a) =>
        `<button class="pill" data-filter="${a.id}">
          ${a.name}
        </button>`
    )
    .join('');

  const dateField =
    document.getElementById('date');

  dateField.value =
    isoDay(state.today);

  dateField.max =
    isoDay(state.today);

  document
    .getElementById('activity')
    .addEventListener(
      'change',
      syncDistanceField
    );

  syncDistanceField();

  document
    .getElementById('log-form')
    .addEventListener(
      'submit',
      (e) => {
        e.preventDefault();
        addSession(e.target);
      }
    );

  document
    .getElementById('filters')
    .addEventListener(
      'click',
      (e) => {
        const pill =
          e.target.closest(
            '[data-filter]'
          );

        if (!pill) return;

        state.filter =
          pill.dataset.filter;

        commit();
      }
    );

  document
    .getElementById('log')
    .addEventListener(
      'click',
      (e) => {
        const btn =
          e.target.closest(
            '[data-delete]'
          );

        if (btn) {
          deleteSession(
            btn.dataset.delete
          );
        }
      }
    );

  document
    .getElementById('target')
    .addEventListener(
      'change',
      (e) => {
        const value =
          Number(e.target.value);

        state.target =
          value > 0
            ? value
            : DEFAULT_TARGET;

        e.target.value =
          state.target;

        commit({
          tone: 'info',
          text: `Weekly target set to ${state.target} minutes.`
        });
      }
    );

  document.getElementById(
    'target'
  ).value = state.target;

  render();
}

document.addEventListener(
  'DOMContentLoaded',
  init
);