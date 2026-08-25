// The match setup screen (spec §4.6): what a player sees on a bare visit,
// before any simulation exists. It writes the choices into the URL the app
// already reads — seed (map), players, civ, teams, difficulty — and reloads,
// so the params stay the single source of configuration and a settings link
// stays shareable. Any visit WITH params skips it entirely, which also keeps
// every harness and test boot exactly as it was.

import { CIVILIZATION_NAMES } from '../../game/simulation/civilizationNames';
import { MAX_STANDARD_PLAYERS } from '../../game/simulation/mapGeneration/applyStandardPlayerOpening/patches';

export interface SetupChoices {
  seed: string;
  players: number;
  civilization: string;
  teams: 'ffa' | 'two-sides';
  difficulty: 'easy' | 'standard' | 'hard';
  resources: 'standard' | 'medium' | 'high';
  victory: 'standard' | 'conquest-only';
  speed: 'slow' | 'normal' | 'fast';
}

/** True when this visit carries any configuration at all — those boot straight
 *  into the match, so the screen shows only on a bare URL. */
export function shouldShowSetupScreen(url: string): boolean {
  return [...new URL(url).searchParams.keys()].length === 0;
}

/** The query string a set of choices boots with. */
export function setupQueryString(choices: SetupChoices): string {
  const params = new URLSearchParams();
  params.set('seed', choices.seed);
  if (choices.players !== 2) params.set('players', String(choices.players));
  params.set('civ', choices.civilization);
  if (choices.teams === 'two-sides') {
    // Half and half, the human on side 1: 1,1,2,2… for the seated count.
    const sides = Array.from({ length: choices.players }, (_unused, index) => (
      index < Math.ceil(choices.players / 2) ? 1 : 2
    ));
    params.set('teams', sides.join(','));
  }
  if (choices.difficulty !== 'standard') params.set('difficulty', choices.difficulty);
  if (choices.resources !== 'standard') params.set('resources', choices.resources);
  if (choices.victory !== 'standard') params.set('victory', choices.victory);
  if (choices.speed !== 'slow') params.set('speed', choices.speed);
  return params.toString();
}

const MAPS: ReadonlyArray<{ seed: string; label: string }> = [
  { seed: 'aoe2-prototype', label: 'Standard' },
  { seed: 'arena', label: 'Arena' },
  { seed: 'black-forest', label: 'Black Forest' },
];

function options(entries: ReadonlyArray<{ value: string; label: string }>, selected: string): string {
  return entries
    .map(({ value, label }) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`)
    .join('');
}

/** Render the screen and resolve never — Start navigates, which reloads. */
export function mountSetupScreen(root: HTMLElement): void {
  const screen = document.createElement('div');
  screen.className = 'setup-screen';
  screen.dataset.hud = 'setup-screen';
  screen.innerHTML = `
    <div class="setup-panel">
      <h1 class="setup-title">Skirmish</h1>
      <p class="setup-subtitle">A standard Random Map match, AoE2-style. Choose your seats and start.</p>
      <label class="setup-row">Map
        <select data-setup="map">${options(MAPS.map((entry) => ({ value: entry.seed, label: entry.label })), 'aoe2-prototype')}</select>
      </label>
      <label class="setup-row">Players
        <select data-setup="players">${options(
          Array.from({ length: MAX_STANDARD_PLAYERS - 1 }, (_unused, index) => {
            const count = index + 2;
            return { value: String(count), label: `${count} (you + ${count - 1} AI)` };
          }),
          '2',
        )}</select>
      </label>
      <label class="setup-row">Your civilization
        <select data-setup="civ">${options(CIVILIZATION_NAMES.map((name) => ({ value: name, label: name })), 'Britons')}</select>
      </label>
      <label class="setup-row">Teams
        <select data-setup="teams">
          <option value="ffa" selected>Free for all</option>
          <option value="two-sides">Two sides (you on side 1)</option>
        </select>
      </label>
      <label class="setup-row">AI difficulty
        <select data-setup="difficulty">
          <option value="easy">Easy</option>
          <option value="standard" selected>Standard</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label class="setup-row">Starting resources
        <select data-setup="resources">
          <option value="standard" selected>Standard (200/200/100/200)</option>
          <option value="medium">Medium (500/500/300/400)</option>
          <option value="high">High (1000/1000/700/800)</option>
        </select>
      </label>
      <label class="setup-row">Victory
        <select data-setup="victory">
          <option value="standard" selected>Standard (conquest, wonder, relics)</option>
          <option value="conquest-only">Conquest only</option>
        </select>
      </label>
      <label class="setup-row">Game speed
        <select data-setup="speed">
          <option value="slow" selected>Slow (1.0x)</option>
          <option value="normal">Normal (1.5x)</option>
          <option value="fast">Fast (2.0x)</option>
        </select>
      </label>
      <button class="setup-start" data-setup="start" type="button">Start Match</button>
    </div>
  `;
  root.appendChild(screen);

  const read = (key: string): string =>
    screen.querySelector<HTMLSelectElement>(`[data-setup="${key}"]`)!.value;
  screen.querySelector<HTMLButtonElement>('[data-setup="start"]')!.addEventListener('click', () => {
    const query = setupQueryString({
      seed: read('map'),
      players: Number(read('players')),
      civilization: read('civ'),
      teams: read('teams') as SetupChoices['teams'],
      difficulty: read('difficulty') as SetupChoices['difficulty'],
      resources: read('resources') as SetupChoices['resources'],
      victory: read('victory') as SetupChoices['victory'],
      speed: read('speed') as SetupChoices['speed'],
    });
    window.location.assign(`${window.location.pathname}?${query}`);
  });
}
