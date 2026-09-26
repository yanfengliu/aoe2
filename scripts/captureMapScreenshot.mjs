import { chromium } from 'playwright';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { captureRasteriserLaunch, refuseFrameFromOtherRasteriser } from './captureRasteriser.mjs';

const label = process.env.LABEL ?? 'screenshot';
// SEED selects the scenario to capture. Defaults to the real default view
// (`aoe2-prototype`, fog on) — the honest target for anything visible at
// boot. Point it at a showcase fixture when the change only affects entities
// the default map doesn't contain (e.g. one building per role).
const seed = process.env.SEED ?? 'aoe2-prototype';
// FOCUS="x,y" centers the camera on a world cell before the shot, so a capture
// can frame something that is not near the map's default view. Omit it and the
// camera stays exactly where the game opens — which is the honest framing for
// anything a player sees at boot.
const focus = process.env.FOCUS ?? '';
// ZOOM sets the camera zoom before the shot (the camera clamps to 0.7-2.4;
// the game opens at 1.2). The renderer's isometric angle is fixed, so a
// multi-view sweep varies FOCUS, ZOOM and SIZE rather than rotating.
const zoom = process.env.ZOOM ?? '';
// SIZE="WxH" captures at a different viewport, because a HUD that fits at
// 1280x800 can cover the world at 800x600.
const size = process.env.SIZE ?? '800x600';
// TICKS advances the simulation before the shot, so a capture can show what a
// mechanic looks like once it has run — a cut woodline, a finished building —
// rather than only the opening frame.
const ticks = Number(process.env.TICKS ?? 0);
// Captures are task-run EVIDENCE, so they default under the gitignored `tmp/`
// tree rather than into tracked docs; set OUT_DIR to promote one deliberately.
const outputDir = process.env.OUT_DIR ?? 'tmp/captures';
const outputPath = `${outputDir}/${label}.png`;
// PREVIEW_PORT selects which `vite preview` to capture from (default 4173).
// The freshness check below proves THIS checkout's dist is newer than its
// sources, but only the port proves the server is serving it: with several
// worktrees on one machine, a sibling's preview on 4173 would be captured as
// if it were ours.
const previewPort = Number(process.env.PREVIEW_PORT ?? 4173);
if (!Number.isInteger(previewPort) || previewPort <= 0 || previewPort > 65535) {
  throw new Error(
    'PREVIEW_PORT must be a TCP port number from 1 to 65535 for the vite preview '
    + `to capture from; got "${process.env.PREVIEW_PORT}"`,
  );
}

function parseSize(value) {
  const match = /^(\d+)x(\d+)$/.exec(value.trim());
  if (!match) {
    throw new Error(`SIZE must be "WIDTHxHEIGHT" in pixels, e.g. "1280x800"; got "${value}"`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

// The page under capture is vite PREVIEW (PREVIEW_PORT), which serves the built
// `dist/` rather than the working tree. A capture taken after a source edit
// but before a rebuild silently shows the PREVIOUS build — a screenshot that
// looks like evidence and proves the opposite. It cost a session once: three
// "after" captures and their pixel diffs were all the stale bundle, and the
// ~1% of pixels that did differ were only the renderer's own ambient
// animation noise. So refuse to capture a build older than its sources.
async function newestModification(directory) {
  let newest = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(directory, entry.name);
    newest = Math.max(newest, entry.isDirectory()
      ? await newestModification(path)
      : (await stat(path)).mtimeMs);
  }
  return newest;
}

const builtAt = await stat('dist/index.html').then(
  (entry) => entry.mtimeMs,
  () => {
    throw new Error(
      'No dist/ to capture. vite preview serves the BUILD, not the working '
      + 'tree, so run `npm run build` before capturing.',
    );
  },
);
const sourceAt = Math.max(await newestModification('src'), await newestModification('scripts'));
if (sourceAt > builtAt) {
  throw new Error(
    'dist/ is older than src/ (built ' + new Date(builtAt).toISOString()
    + ', newest source ' + new Date(sourceAt).toISOString()
    + '). vite preview serves the BUILD, so this capture would show the '
    + 'PREVIOUS build. Run `npm run build` first.',
  );
}
// ...and prove the server on PREVIEW_PORT is serving THIS dist: vite names
// every asset by its content hash — the JS bundle AND the extracted CSS, with
// independent hashes, so a styles-only build is told apart too — and a
// mismatch means another checkout's preview holds the port (vite preview reads
// dist/ on every request, so one started from THIS checkout serves each rebuild
// without a restart).
const bundleOf = (html) => [...new Set(html.match(/assets\/[\w.-]+/g) ?? [])].sort().join(' ');
const localBundle = bundleOf(await readFile('dist/index.html', 'utf8'));
const servedHtml = await fetch(`http://127.0.0.1:${previewPort}/`).then(
  (response) => response.text(),
  (error) => {
    throw new Error(
      `No vite preview answered on port ${previewPort} (${error.message}). Start one from this `
      + `checkout (npm run preview -- --host 127.0.0.1 --port ${previewPort} --strictPort) or set `
      + 'PREVIEW_PORT to the port of the one that is running.',
    );
  },
);
const servedBundle = bundleOf(servedHtml);
if (servedBundle !== localBundle) {
  throw new Error(
    `The preview on port ${previewPort} serves [${servedBundle || 'no hashed assets'}] but this `
    + `checkout's dist/ holds [${localBundle}]: another checkout's (or a stale) vite preview holds `
    + 'the port. Restart it from this checkout, or capture with PREVIEW_PORT=<its port>.',
  );
}

// RASTERISER=swiftshader|gpu chooses what draws the frame: `swiftshader` (the
// default, and what every capture before 2026-09-24 used) is the CPU rasteriser
// CI's browser suite draws with, and `gpu` is ANGLE's Direct3D 11 backend, what
// a player's graphics card draws (Windows only). A shader change is looked at on
// both. The rules, and the refusal of a frame another rasteriser drew, live in
// captureRasteriser.mjs, which tests/scripts/captureRasteriser.test.ts holds.
const launch = captureRasteriserLaunch(process.env.RASTERISER, process.platform);

await mkdir(dirname(outputPath), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: launch.args,
});

try {
  const context = await browser.newContext({
    viewport: parseSize(size),
  });
  const page = await context.newPage();
  // PLAYERS=n captures a multi-player skirmish (?players=), which is the only
  // way to SEE that three players look like three players.
  const players = process.env.PLAYERS;
  // CIV=<name> boots the human as that civilization (?civ=), the only way to
  // SEE a civ-specific visual (e.g. the Vietnamese boot-time reveal ghost).
  const civ = process.env.CIV;
  // TEAMS="1,1,2" boots a team game (?teams=, one side per player in owner
  // order), the only way to SEE what an ally's shared vision shows. It needs
  // PLAYERS to match, and the same rules parseTeamAssignment applies: a side is
  // a whole number from 1 and there are at least two sides. The game ignores
  // any other list, and the capture would silently be a free-for-all.
  const teams = process.env.TEAMS ?? '';
  if (teams && !/^\d+(,\d+)+$/.test(teams)) {
    throw new Error(`TEAMS must be one side number per player, e.g. "1,1,2"; got "${teams}"`);
  }
  if (teams) {
    const sides = teams.split(',').map(Number);
    if (sides.some((side) => side < 1) || new Set(sides).size < 2) {
      throw new Error(
        `TEAMS="${teams}" is a list the game ignores: every side must be 1 or more and there must be `
        + 'at least two different sides (e.g. "1,1,2"), or the capture would be a free-for-all.',
      );
    }
  }
  if (teams && teams.split(',').length !== Number(players ?? 2)) {
    throw new Error(
      `TEAMS="${teams}" names ${teams.split(',').length} players but PLAYERS is ${players ?? '2 (the default)'}; `
      + 'the game ignores a team list of the wrong length, so the capture would be a free-for-all.',
    );
  }
  const query = `?seed=${seed}`
    + (players ? `&players=${players}` : '')
    + (teams ? `&teams=${teams}` : '')
    + (civ ? `&civ=${encodeURIComponent(civ)}` : '');
  // Pause the sim from the first moment the test API exists — the same
  // init-script poll the browser suite's waitForPausedBootWithSeed uses —
  // rather than only after isBooted() resolves: the ticks that slipped
  // through in between varied run to run, so a before/after pair could land
  // a second of game time apart (units, sheep and water moved) and the diff
  // was not confined to the change (2026-09-02, idle-bell captures).
  // STYLE=moebius|de captures under a chosen art style. The style is a
  // localStorage preference with no URL form, so a sweep that only boots the
  // default sees one of the two looks the game ships, and they differ in
  // kind: Moebius quantises shading into tone bands, so it can hide or
  // exaggerate a change the DE style renders as a smooth gradient. Written
  // before the first navigation so the renderer reads it at construction.
  const style = process.env.STYLE ?? '';
  if (style) {
    if (style !== 'moebius' && style !== 'de') {
      throw new Error(
        'STYLE selects the art style to capture under and must be "moebius" or "de" '
        + `(the two styles the game ships); got "${style}".`,
      );
    }
    await page.addInitScript((chosen) => {
      try {
        window.localStorage.setItem('aoe2:art-style', chosen);
      } catch {
        // Storage disabled for the origin: the game falls back to its default
        // style, and the capture below refuses a frame in the wrong style.
      }
    }, style);
  }
  // GROUND_TIER=blend|single-sample draws the Natural ground with that shader
  // whatever the rasteriser (src/rendering/voxel/aoeDeGroundTier.ts): unset,
  // SwiftShader draws one sample per pixel and a graphics card the blend, so
  // this is how the blend is looked at on SwiftShader.
  const groundTier = process.env.GROUND_TIER ?? '';
  if (groundTier) {
    if (groundTier !== 'blend' && groundTier !== 'single-sample') {
      throw new Error(
        'GROUND_TIER selects the Natural ground\'s shader and must be "blend" or "single-sample"; '
        + `got "${groundTier}".`,
      );
    }
    await page.addInitScript((chosen) => {
      try {
        window.localStorage.setItem('aoe2:de-ground-tier', chosen);
      } catch {
        // Refused below, where the drawn tier is read back.
      }
    }, groundTier);
  }
  await page.addInitScript(() => {
    const timer = window.setInterval(() => {
      if (!window.__AOE2_TEST__) return;
      window.__AOE2_TEST__.setPaused(true);
      window.clearInterval(timer);
    }, 0);
  });
  await page.goto(`http://127.0.0.1:${previewPort}/${query}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, {
    timeout: 60_000,
  });
  // A capture labelled with a style must be OF that style: storage can be
  // refused, and a build without the setting would ignore it silently.
  const drawnStyle = await page.evaluate(() => window.__AOE2_TEST__?.getWorldRendererState().artStyle);
  if (style && drawnStyle !== style) {
    throw new Error(
      `STYLE=${style} was asked for, but the canvas is drawn in "${drawnStyle}": the style is read `
      + 'from localStorage (aoe2:art-style) at boot. Capture a build that has the art-style setting '
      + '(v0.3.227 or later), from an origin whose storage is not blocked.',
    );
  }
  // ...and drawn by the rasteriser it is labelled with, asked of the game
  // canvas's own WebGL context rather than of the launch arguments.
  const drawnBy = await page.evaluate(() => {
    const canvas = document.querySelector('.voxel-world-canvas');
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : undefined;
  });
  refuseFrameFromOtherRasteriser(launch.rasteriser, drawnBy);
  const drawnGround = await page.evaluate(() => {
    const state = window.__AOE2_TEST__?.getWorldRendererState();
    return { ground: state?.ground, tier: state?.groundTier };
  });
  const drawnTier = drawnGround.ground === 'textured' ? drawnGround.tier : undefined;
  if (groundTier && drawnGround.ground !== 'textured') {
    throw new Error(
      `GROUND_TIER=${groundTier} was asked for, but the canvas draws the ${drawnGround.ground ?? 'unknown'} ground, `
      + 'not the Natural style\'s textured ground the tier belongs to: capture with STYLE=de.',
    );
  }
  if (groundTier && drawnTier !== groundTier) {
    throw new Error(
      `GROUND_TIER=${groundTier} was asked for, but the ground draws with "${drawnTier}": the tier is read from `
      + 'localStorage (aoe2:de-ground-tier) when the renderer is built. Capture a build that has the tier '
      + '(v0.3.237 or later), from an origin whose storage is not blocked.',
    );
  }
  console.log(`drawn by ${drawnBy}${drawnTier ? `, ground tier ${drawnTier}` : ''}`);
  // Freeze the sim the moment it boots: the page otherwise free-runs in real
  // time through staging (BUILD/FOCUS/ZOOM evaluates take real seconds), so a
  // capture's tick was "TICKS plus however long the tooling took" — and any
  // short-lived transient (a death collapse lives 10 ticks) was ALWAYS gone
  // by screenshot time. TICKS advances are exact from tick ~0 now, and the
  // screenshot is taken still paused; pause-frozen rendering is byte-identical
  // by project invariant, so nothing else changes.
  await page.evaluate(() => { window.__AOE2_TEST__?.setPaused(true); });
  // BUILD="house@10,16" places a building via a selected villager BEFORE the
  // TICKS run, so a capture can stage a real mid-construction site.
  const build = process.env.BUILD ?? '';
  if (build) {
    const match = /^([a-z-]+)@(\d+),(\d+)$/.exec(build);
    if (!match) throw new Error(`BUILD must look like house@10,16; got "${build}"`);
    const [, buildingType, bx, by] = match;
    const placed = await page.evaluate(([type, x, y]) => {
      const api = window.__AOE2_TEST__;
      const eco = api.getEconomyState();
      const villager = eco.units.find((u) => u.owner === 1 && u.unitType === 'villager');
      if (!villager) return 'no villager';
      if (!api.selectEntityAtCell(villager.x, villager.y)) return 'select failed';
      if (!api.beginBuildingPlacement(type)) return 'begin failed';
      if (!api.confirmBuildingPlacement(Number(x), Number(y))) return 'confirm failed';
      return 'ok';
    }, [buildingType, bx, by]);
    if (placed !== 'ok') throw new Error(`BUILD ${build} failed: ${placed}`);
  }
  // SELECT="<type>" selects the human's first entity of that type before the
  // shot (no order is given), so a capture can show the command bar in a
  // SELECTED state — where the 2026-09-02 idle-bell overlap lived, and which
  // no boot capture can reach. A unit type (villager, scout), a building type
  // (town-center, house) or a resource in the human's base (sheep, tree,
  // berry-bush, gold-mine, stone-mine) — because the bar's height depended on
  // WHICH of these was selected (2026-09-05), so proving it does not takes a
  // capture of each. SELECT="box" selects every unit the human owns, the
  // mixed selection a marquee over the base makes.
  const select = process.env.SELECT ?? '';
  if (select) {
    const selected = await page.evaluate((type) => {
      const api = window.__AOE2_TEST__;
      const economy = api.getEconomyState();
      if (type === 'box') {
        const size = api.getMapSize();
        return api.selectUnitsInBox(0, 0, size.width - 1, size.height - 1) ? 'ok' : 'select failed';
      }
      const unit = economy.units.find((u) => u.owner === 1 && u.unitType === type);
      if (unit) return api.selectEntityAtCell(unit.x, unit.y) ? 'ok' : 'select failed';
      const building = economy.buildings.find((b) => b.owner === 1 && b.buildingType === type);
      if (building) {
        for (let dy = 0; dy < building.footprintHeight; dy += 1) {
          for (let dx = 0; dx < building.footprintWidth; dx += 1) {
            api.selectEntityAtCell(building.x + dx, building.y + dy);
            if (api.getSelectionState().selectedEntityType === type) return 'ok';
          }
        }
        return 'select failed';
      }
      const resource = economy.resources.find(
        (r) => r.resourceType === type && (r.owner === 1 || r.baseOwner === 1),
      );
      if (resource) return api.selectEntityAtCell(resource.x, resource.y) ? 'ok' : 'select failed';
      return `the human owns no ${type} at boot (no unit, building or base resource of that type)`;
    }, select);
    if (selected !== 'ok') {
      throw new Error(
        `SELECT must name a unit, building or base-resource type the human owns at boot `
        + `(e.g. villager, town-center, tree) or "box"; "${select}" failed: ${selected}`,
      );
    }
  }

  // GATHER="x,y" orders every unit the human owns to one cell before the TICKS
  // run, so a capture can show a CROWD. Units share cells here (four villagers
  // on one tile is ordinary), and a crowd is where per-entity ground art —
  // shadows, selection rings, health bars — either composes or piles up; no
  // boot capture reaches that state.
  const gather = process.env.GATHER ?? '';
  if (gather) {
    const [gatherX, gatherY] = gather.split(',').map(Number);
    if (!Number.isFinite(gatherX) || !Number.isFinite(gatherY)) {
      throw new Error(`GATHER must be "x,y" world cells to send the human's units to; got "${gather}"`);
    }
    const gathered = await page.evaluate(([x, y]) => {
      const api = window.__AOE2_TEST__;
      const size = api.getMapSize();
      if (!api.selectUnitsInBox(0, 0, size.width, size.height)) return 'no units selected';
      return api.issueMoveCommand(x, y) ? 'ok' : 'move command rejected';
    }, [gatherX, gatherY]);
    if (gathered !== 'ok') throw new Error(`GATHER ${gather} failed: ${gathered}`);
  }
  // ATTACK="mangonel@24,10" selects the human's first unit of that type and
  // gives the right-click order on that cell before the TICKS run, so a
  // capture can show a fight in progress: a shot in the air, where it lands,
  // what its blast leaves. It is the context order a right-click gives, so
  // whatever stands on the cell decides what the order is.
  const attack = process.env.ATTACK ?? '';
  if (attack) {
    const match = /^([a-z-]+)@(\d+),(\d+)$/.exec(attack);
    if (!match) throw new Error(`ATTACK must look like mangonel@24,10 (a unit type the human owns, then a cell); got "${attack}"`);
    const [, unitType, ax, ay] = match;
    const ordered = await page.evaluate(([type, x, y]) => {
      const api = window.__AOE2_TEST__;
      const unit = api.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === type);
      if (!unit) return `the human owns no ${type}`;
      if (!api.selectEntityAtCell(unit.x, unit.y)) return `the ${type} at (${unit.x}, ${unit.y}) could not be selected`;
      return api.issueContextCommand(Number(x), Number(y)) ? 'ok' : 'the order was refused';
    }, [unitType, ax, ay]);
    if (ordered !== 'ok') throw new Error(`ATTACK ${attack} failed: ${ordered}`);
  }
  if (focus) {
    const [focusX, focusY] = focus.split(',').map(Number);
    if (!Number.isFinite(focusX) || !Number.isFinite(focusY)) {
      throw new Error(`FOCUS must be "x,y" world cells; got "${focus}"`);
    }
    await page.evaluate(
      ([x, y]) => { window.__AOE2_TEST__?.centerCameraOnWorldPosition(x, y); },
      [focusX, focusY],
    );
  }
  if (zoom) {
    const zoomValue = Number(zoom);
    if (!Number.isFinite(zoomValue) || zoomValue <= 0) {
      throw new Error(`ZOOM must be a positive number; got "${zoom}"`);
    }
    const applied = await page.evaluate(
      (value) => window.__AOE2_TEST__?.setCameraZoom(value),
      zoomValue,
    );
    if (applied !== zoomValue) {
      console.log(`ZOOM ${zoomValue} clamped to ${applied} by the camera`);
    }
  }
  if (ticks > 0) {
    if (!Number.isInteger(ticks)) {
      throw new Error(`TICKS must be a whole number of simulation ticks; got "${process.env.TICKS}"`);
    }
    // advanceTicks is atomic (unpause -> step N -> repause) inside the page, so
    // it is exact; chunked so a long advance does not exceed the call timeout.
    // The sim STAYS paused afterwards — the screenshot is of exactly this tick.
    let done = 0;
    while (done < ticks) {
      const chunk = Math.min(500, ticks - done);
      await page.evaluate((count) => { window.__AOE2_TEST__?.advanceTicks(count); }, chunk);
      done += chunk;
    }
  }
  // HOTKEY="F4" (or "F4,Escape") presses keys before the shot, so a capture can
  // show a HUD PANEL — a modal the world view never reaches on its own. Without
  // it every panel in this game had to be photographed by a one-off script,
  // which is what this file exists to replace: the freshness and port checks
  // above are the whole reason a capture can be trusted, and a bespoke script
  // has neither.
  const hotkeys = (process.env.HOTKEY ?? '').split(',').map((key) => key.trim()).filter(Boolean);
  for (const key of hotkeys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`saved ${outputPath}`);
} finally {
  await browser.close();
}
