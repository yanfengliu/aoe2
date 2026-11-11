// scripts/cpuProfileFold.mjs folds a Chrome CPU profile of the built game into named phases, naming minified code
// through the build's source map. These cases hold the three things a wrong answer would hide behind: the source-map
// lookup (a position in the bundle to the line it was written on), the partition (a sample goes to the innermost
// phase on its stack, and the rows add up to the profiled time), and the split of frames into those that ran a
// simulation tick and those between ticks.
//
// BOUND. Synthetic profiles and a hand-built source map: the shapes are V8's and the source-map specification's,
// written out here, not captured from a browser. That a real profile of the real build folds into the real phases
// is tests/scripts/framePhases.test.ts's half (every phase still finds its line) and the measured record's.

import { describe, expect, it } from 'vitest';

import {
  decodeMappings,
  foldCpuProfile,
  frameResolver,
  heaviestFunctions,
  sourceLookup,
  tidySourcePath,
} from '../../scripts/cpuProfileFold.mjs';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** The source-map specification's base64 VLQ, written independently of the decoder under test. */
function vlq(value: number): string {
  let rest = value < 0 ? ((-value) << 1) | 1 : value << 1;
  let text = '';
  do {
    const digit = rest & 31;
    rest >>>= 5;
    text += BASE64[rest > 0 ? digit | 32 : digit];
  } while (rest > 0);
  return text;
}

/** Mappings for segments given as absolute [generatedColumn, source, line, column] per generated line. */
function encodeMappings(lines: ReadonlyArray<ReadonlyArray<readonly [number, number, number, number]>>): string {
  let source = 0;
  let line = 0;
  let column = 0;
  return lines.map((segments) => {
    let generatedColumn = 0;
    return segments.map(([genColumn, src, srcLine, srcColumn]) => {
      const text = vlq(genColumn - generatedColumn) + vlq(src - source) + vlq(srcLine - line) + vlq(srcColumn - column);
      generatedColumn = genColumn;
      source = src;
      line = srcLine;
      column = srcColumn;
      return text;
    }).join(',');
  }).join(';');
}

describe('a source map\'s mappings', () => {
  it('decodes the specification\'s own example of a VLQ', () => {
    // "AAAA" is four zeros; "SAAS" is [9, 0, 0, 9]; "gB" is 16 and "D" is -1 in base64 VLQ.
    expect(decodeMappings('AAAA,SAAS')).toEqual([[[0, 0, 0, 0], [9, 0, 0, 9]]]);
    expect(decodeMappings('gBAAD')).toEqual([[[16, 0, 0, -1]]]);
  });

  it('carries source, line and column across lines, and the generated column within one', () => {
    const segments = [
      [[0, 0, 0, 0], [120_000, 1, 41, 2], [120_030, 1, 44, 8]],
      [],
      [[7, 0, 9, 4], [2_000_000, 2, 0, 0]],
    ] as const;
    expect(decodeMappings(encodeMappings(segments))).toEqual(segments.map((line) => line.map((segment) => [...segment])));
  });

  it('refuses mappings that are not base64', () => {
    expect(() => decodeMappings('AA!A')).toThrow(/"!", which is not base64/);
  });
});

describe('where a position in the bundle was written', () => {
  const map = {
    sources: ['../../src/app/view.ts', '../../../../aoe2/node_modules/three/build/three.core.js', '../../../../voxel/dist/three/Runtime.js'],
    sourcesContent: [
      'import x from "y";\n\nexport class View {\n  private readonly frame = (timeMs: number): void => {\n    this.step();\n  };\n}\n',
      '// three\nclass Matrix4 {\n\ttoArray( array = [], offset = 0 ) {\n\t}\n}\n',
      null,
    ],
    // One minified line: `frame` at column 100 (written on line 4 of view.ts), `toArray` at column 5,000.
    mappings: encodeMappings([[[0, 0, 0, 0], [100, 0, 3, 27], [140, 0, 4, 4], [5_000, 1, 2, 1], [9_000, 2, 259, 4]]]),
  };
  const lookup = sourceLookup(map);

  it('names the file as the repo and its packages are laid out, and gives the line and its text', () => {
    expect(lookup(0, 100)).toEqual({ file: 'src/app/view.ts', line: 4, text: 'private readonly frame = (timeMs: number): void => {' });
    expect(lookup(0, 5_000)).toEqual({ file: 'three/build/three.core.js', line: 3, text: 'toArray( array = [], offset = 0 ) {' });
  });

  it('takes the last segment at or before the column', () => {
    expect(lookup(0, 139)?.line).toBe(4);
    expect(lookup(0, 140)?.line).toBe(5);
    expect(lookup(0, 4_999)?.line).toBe(5);
  });

  it('gives a source with no content its file and line, and no text', () => {
    expect(lookup(0, 9_500)).toEqual({ file: 'voxel/dist/three/Runtime.js', line: 260, text: '' });
  });

  it('has no answer for a line the map does not hold', () => {
    expect(lookup(3, 0)).toBeNull();
  });

  it('tidies the paths a vite build writes', () => {
    expect(tidySourcePath('../../src/rendering/voxel/aoeVoxelAdapter.ts')).toBe('src/rendering/voxel/aoeVoxelAdapter.ts');
    expect(tidySourcePath('../../../../voxel/dist/core/contracts.js')).toBe('voxel/dist/core/contracts.js');
    expect(tidySourcePath('../../../../aoe2/node_modules/civ-engine/dist/json.js')).toBe('civ-engine/dist/json.js');
    expect(tidySourcePath('..\\..\\src\\app\\x.ts')).toBe('src/app/x.ts');
  });

  it('resolves a call frame through its script\'s map, and keeps V8\'s own names where there is none', () => {
    const resolve = frameResolver((url: string) => (url.endsWith('/assets/index-abc.js') ? lookup : null));
    expect(resolve({ functionName: 'f', url: 'http://127.0.0.1:4325/assets/index-abc.js', lineNumber: 0, columnNumber: 100 }))
      .toEqual({ name: 'f', file: 'src/app/view.ts', line: 4, text: 'private readonly frame = (timeMs: number): void => {' });
    expect(resolve({ functionName: '(garbage collector)', url: '', lineNumber: -1, columnNumber: -1 }))
      .toEqual({ name: '(garbage collector)', file: '', line: 0, text: '' });
    expect(resolve({ functionName: 'w', url: 'http://127.0.0.1:4325/assets/worker.js', lineNumber: 4, columnNumber: 2 }))
      .toEqual({ name: 'w', file: 'assets/worker.js', line: 5, text: '' });
  });
});

// A profile in V8's shape. The resolver reads a node's phase straight from its name, as the real one reads it from
// the source map: file "f" and the function's name as its line of text.
interface Node { id: number; name: string; children?: number[] }

function profileOf(nodes: Node[], samples: Array<[node: number, ms: number]>) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      callFrame: { functionName: node.name, url: node.name.startsWith('(') ? '' : 'f', lineNumber: 0, columnNumber: 0 },
      children: node.children ?? [],
    })),
    startTime: 0,
    // A sample lasts until the next one, so the first delta is 0 and the last sample ends with the profile.
    samples: samples.map(([node]) => node),
    timeDeltas: [0, ...samples.slice(0, -1).map(([, ms]) => ms * 1000)],
    endTime: samples.reduce((sum, [, ms]) => sum + ms * 1000, 0),
  };
}

const resolve = (callFrame: { functionName: string; url: string }) => ({
  name: callFrame.functionName, file: callFrame.url, line: 1, text: callFrame.functionName,
});
const phase = (key: string) => ({ key, file: /^f$/, text: new RegExp(`^${key}$`) });

const NODES: Node[] = [
  { id: 1, name: '(root)', children: [2, 9, 10, 11, 12, 13] },
  { id: 2, name: 'frame', children: [3, 6, 8] },
  { id: 3, name: 'tick', children: [4, 5] },
  { id: 4, name: 'systemA' },
  { id: 5, name: 'json' },
  { id: 6, name: 'present', children: [7] },
  { id: 7, name: 'writes' },
  { id: 8, name: 'camera' },
  { id: 9, name: 'hud' },
  { id: 10, name: '(idle)' },
  { id: 11, name: '(garbage collector)' },
  { id: 12, name: '(program)' },
  // A stack V8 could not walk back to the root: the comparator that Array.prototype.sort called inside `present`.
  { id: 13, name: 'comparator' },
];
const PHASES = [phase('frame'), phase('tick'), phase('json'), phase('present'), phase('writes'), phase('hud')];
const KINDS = { frame: 'frame', tick: 'tick', otherTasks: ['hud'] };

describe('a profile folded into phases', () => {
  const profile = profileOf(NODES, [
    [4, 3], [5, 2], [3, 1], // a tick: 3 ms in a system, 2 in json under it, 1 in the tick's own code
    [6, 4], [7, 5], // the presentation: 4 ms of its own, 5 in the writes it calls
    [8, 1], // the camera, which no phase names: the frame's own row
    [9, 2], [10, 6], [11, 1],
  ]);
  const fold = foldCpuProfile(profile, PHASES, resolve);
  const ms = (key: string) => fold.rows.find((row) => row.key === key)?.ms;

  it('counts a sample to the innermost phase on its stack', () => {
    expect(ms('tick')).toBe(4);
    expect(ms('json')).toBe(2);
    expect(ms('present')).toBe(4);
    expect(ms('writes')).toBe(5);
    expect(ms('frame')).toBe(1);
    expect(ms('hud')).toBe(2);
  });

  it('gives V8\'s own rows their names, and adds up to the profiled time', () => {
    expect(ms('(idle)')).toBe(6);
    expect(ms('(garbage collector)')).toBe(1);
    expect(fold.totalMs).toBe(25);
    expect(fold.rows.reduce((sum, row) => sum + row.ms, 0)).toBe(25);
    expect(fold.samples).toBe(9);
    expect(fold.frames).toBeNull();
  });

  it('lists what no phase claims by the task it ran in', () => {
    // The unwalked comparator has only itself to be named by; the camera is named by the frame it ran in.
    const unclaimed = foldCpuProfile(profileOf(NODES, [[13, 2], [8, 1], [4, 5]]), [phase('tick')], resolve);
    expect(unclaimed.rows.find((row) => row.key === 'unclaimed')?.ms).toBe(3);
    expect(unclaimed.unclaimed.map((entry) => [entry.name, entry.ms])).toEqual([['comparator', 2], ['frame', 1]]);
  });
});

describe('frames with a tick and frames between ticks', () => {
  const tickFrame: Array<[number, number]> = [[4, 6], [5, 2], [6, 3], [7, 4]]; // 15 ms
  const betweenFrame: Array<[number, number]> = [[6, 1], [7, 2]]; // 3 ms
  const hud: [number, number] = [9, 1];

  it('splits the frames by whether a tick ran in them, a phase\'s time with them', () => {
    const fold = foldCpuProfile(profileOf(NODES, [...tickFrame, hud, ...betweenFrame, hud, ...betweenFrame, hud, ...tickFrame, hud]), PHASES, resolve, KINDS);
    expect(fold.frames?.tick).toMatchObject({ frames: 2, ms: 30 });
    expect(fold.frames?.between).toMatchObject({ frames: 2, ms: 6 });
    const of = (kind: 'tick' | 'between', key: string) => fold.frames?.[kind].rows.find((row) => row.key === key)?.ms;
    expect(of('tick', 'tick')).toBe(12);
    expect(of('tick', 'json')).toBe(4);
    expect(of('tick', 'writes')).toBe(8);
    expect(of('between', 'writes')).toBe(4);
    expect(of('between', 'tick')).toBeUndefined();
    // The HUD's update is no part of a world frame.
    expect(of('tick', 'hud')).toBeUndefined();
  });

  it('ends a frame at the idle thread as well as at another task', () => {
    const fold = foldCpuProfile(profileOf(NODES, [...betweenFrame, [10, 9], ...betweenFrame, [10, 9]]), PHASES, resolve, KINDS);
    expect(fold.frames?.between).toMatchObject({ frames: 2, ms: 6 });
  });

  it('keeps the garbage collector, "(program)" and an unwalked stack inside the frame they interrupt', () => {
    const interrupted: Array<[number, number]> = [[4, 6], [11, 2], [6, 3], [13, 1], [12, 1], [7, 4]];
    const fold = foldCpuProfile(profileOf(NODES, [...interrupted, hud, [11, 5], [10, 3]]), PHASES, resolve, KINDS);
    expect(fold.frames?.tick).toMatchObject({ frames: 1, ms: 17 });
    expect(fold.frames?.between.frames).toBe(0);
    expect(fold.frames?.tick.rows.find((row) => row.key === '(garbage collector)')?.ms).toBe(2);
    expect(fold.frames?.tick.rows.find((row) => row.key === 'unclaimed')?.ms).toBe(1);
    // A collection after the frame has ended belongs to no frame.
    expect(fold.rows.find((row) => row.key === '(garbage collector)')?.ms).toBe(7);
  });

  it('drops an interruption that no sample of the frame follows', () => {
    const fold = foldCpuProfile(profileOf(NODES, [...betweenFrame, [11, 4], hud]), PHASES, resolve, KINDS);
    expect(fold.frames?.between).toMatchObject({ frames: 1, ms: 3 });
  });
});

describe('frames the page marks by alternating two functions', () => {
  // The page runs alternate frames' callbacks through `evenFrame` and `oddFrame`, so the same frame code hangs
  // under two nodes of the tree. Nothing else separates these frames: no HUD sample, no idle thread.
  const nodes: Node[] = [
    { id: 1, name: '(root)', children: [2, 3, 12] },
    { id: 2, name: 'evenFrame', children: [4] },
    { id: 3, name: 'oddFrame', children: [8] },
    { id: 4, name: 'frame', children: [5, 7] },
    { id: 5, name: 'tick', children: [6] },
    { id: 6, name: 'systemA' },
    { id: 7, name: 'writes' },
    { id: 8, name: 'frame', children: [9, 11] },
    { id: 9, name: 'tick', children: [10] },
    { id: 10, name: 'systemA' },
    { id: 11, name: 'writes' },
    { id: 12, name: '(garbage collector)' },
  ];
  const slot = /^(even|odd)Frame$/;
  // Even frame: a tick (6 ms) and writes (4). Odd: writes (3). Even: writes (3). Odd: a tick (6) and writes (4).
  const samples: Array<[number, number]> = [[6, 6], [7, 4], [11, 3], [7, 3], [10, 6], [11, 4]];

  it('ends a frame where the function changes, with no other task between two frames', () => {
    const fold = foldCpuProfile(profileOf(nodes, samples), PHASES, resolve, { ...KINDS, slot });
    expect(fold.frames?.tick).toMatchObject({ frames: 2, ms: 20 });
    expect(fold.frames?.between).toMatchObject({ frames: 2, ms: 6 });
  });

  it('counts the same samples as one long frame when the functions are not named', () => {
    // The bound the header states: without the marks, back-to-back frames are one run.
    const fold = foldCpuProfile(profileOf(nodes, samples), PHASES, resolve, KINDS);
    expect(fold.frames?.tick).toMatchObject({ frames: 1, ms: 26 });
    expect(fold.frames?.between.frames).toBe(0);
  });

  it('gives a collection between two frames to neither', () => {
    const fold = foldCpuProfile(profileOf(nodes, [[7, 3], [12, 5], [11, 3]]), PHASES, resolve, { ...KINDS, slot });
    expect(fold.frames?.between).toMatchObject({ frames: 2, ms: 6 });
  });

  it('keeps a collection inside the frame it interrupts', () => {
    const fold = foldCpuProfile(profileOf(nodes, [[7, 3], [12, 5], [7, 2], [11, 3]]), PHASES, resolve, { ...KINDS, slot });
    expect(fold.frames?.between).toMatchObject({ frames: 2, ms: 13 });
  });
});

describe('the heaviest functions', () => {
  it('ranks by self time and by time with callees, a recursive function counted once a stack', () => {
    const nodes: Node[] = [
      { id: 1, name: '(root)', children: [2] },
      { id: 2, name: 'walk', children: [3] },
      { id: 3, name: 'walk', children: [4] },
      { id: 4, name: 'leaf' },
    ];
    const heaviest = heaviestFunctions(profileOf(nodes, [[2, 1], [3, 2], [4, 7]]), resolve, 2);
    expect(heaviest.totalMs).toBe(10);
    expect(heaviest.self.map((entry) => [entry.label, entry.ms])).toEqual([['leaf f:1 | leaf', 7], ['walk f:1 | walk', 3]]);
    // `walk` is on every stack, twice on two of them: 10 ms, not 19.
    expect(heaviest.inclusive[0]).toMatchObject({ ms: 10, share: 1 });
    expect(heaviest.inclusive.find((entry) => entry.label.startsWith('walk'))?.ms).toBe(10);
  });
});
