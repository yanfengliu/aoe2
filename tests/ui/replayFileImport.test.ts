// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createReplayFileImport } from '../../src/ui/replay/replayFileImport';
import type { ReplayController } from '../../src/game/replay/ReplayController';

const validBundle = {
  schemaVersion: 1,
  metadata: { sessionId: 's1', startTick: 0, endTick: 5, sourceKind: 'session', sourceLabel: 'test', recordedAt: '2026-05-06T00:00:00.000Z' },
  commands: [{ submissionTick: 1, sequence: 0, type: 'unit.move' }],
  initialSnapshot: { tick: 0, state: [] },
  ticks: [],
  executions: [],
  failures: [],
  snapshots: [],
  markers: [],
  attachments: [],
};

const stubController = (
  enterReplay: (bundle: unknown) => void = vi.fn(),
): Pick<ReplayController, 'enterReplay'> => ({
  enterReplay: enterReplay as unknown as ReplayController['enterReplay'],
});

const fakeFile = (json: string): File =>
  new File([json], 'bundle.json', { type: 'application/json' });

const installInputFiles = (input: HTMLInputElement, files: File[]): void => {
  Object.defineProperty(input, 'files', {
    value: files.length === 0 ? null : ({
      length: files.length,
      item: (i: number) => files[i] ?? null,
      0: files[0],
    } as unknown as FileList),
    configurable: true,
  });
};

describe('createReplayFileImport', () => {
  let host: HTMLElement;
  let toast: { showToast: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    toast = { showToast: vi.fn() };
  });

  it('mounts a hidden file input under the host', () => {
    const handle = createReplayFileImport({ host, replayController: stubController(), toast });
    const input = host.querySelector<HTMLInputElement>('[data-testid="replay-file-import-input"]')!;
    expect(input).not.toBeNull();
    expect(input.type).toBe('file');
    expect(input.accept).toBe('application/json,.json');
    expect(input.style.display).toBe('none');
    handle.dispose();
  });

  it('promptForFile clicks the hidden input', () => {
    const handle = createReplayFileImport({ host, replayController: stubController(), toast });
    const input = host.querySelector<HTMLInputElement>('[data-testid="replay-file-import-input"]')!;
    const click = vi.spyOn(input, 'click');
    handle.promptForFile();
    expect(click).toHaveBeenCalledTimes(1);
    handle.dispose();
  });

  it('valid bundle JSON triggers enterReplay', async () => {
    const enterReplay = vi.fn();
    const handle = createReplayFileImport({ host, replayController: stubController(enterReplay), toast });
    const input = host.querySelector<HTMLInputElement>('[data-testid="replay-file-import-input"]')!;
    installInputFiles(input, [fakeFile(JSON.stringify(validBundle))]);
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 5));
    expect(enterReplay).toHaveBeenCalledTimes(1);
    expect(enterReplay.mock.calls[0][0]).toMatchObject({ metadata: { sessionId: 's1' } });
    handle.dispose();
  });

  it('invalid JSON triggers a toast', async () => {
    const enterReplay = vi.fn();
    const handle = createReplayFileImport({ host, replayController: stubController(enterReplay), toast });
    const input = host.querySelector<HTMLInputElement>('[data-testid="replay-file-import-input"]')!;
    installInputFiles(input, [fakeFile('not valid json')]);
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 5));
    expect(enterReplay).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('Invalid bundle file: invalid JSON');
    handle.dispose();
  });

  it('missing field surfaces a structured toast', async () => {
    const enterReplay = vi.fn();
    const handle = createReplayFileImport({ host, replayController: stubController(enterReplay), toast });
    const input = host.querySelector<HTMLInputElement>('[data-testid="replay-file-import-input"]')!;
    const { commands: _commands, ...partialBundle } = validBundle;
    void _commands;
    installInputFiles(input, [fakeFile(JSON.stringify(partialBundle))]);
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 5));
    expect(enterReplay).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('Invalid bundle file: missing field commands');
    handle.dispose();
  });

  it('no file selected is a no-op (cancel)', async () => {
    const enterReplay = vi.fn();
    const handle = createReplayFileImport({ host, replayController: stubController(enterReplay), toast });
    const input = host.querySelector<HTMLInputElement>('[data-testid="replay-file-import-input"]')!;
    installInputFiles(input, []);
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 5));
    expect(enterReplay).not.toHaveBeenCalled();
    expect(toast.showToast).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('enterReplay throws → "Replay failed: <message>" toast', async () => {
    const enterReplay = vi.fn(() => {
      throw new Error('controller rejected');
    });
    const handle = createReplayFileImport({ host, replayController: stubController(enterReplay), toast });
    const input = host.querySelector<HTMLInputElement>('[data-testid="replay-file-import-input"]')!;
    installInputFiles(input, [fakeFile(JSON.stringify(validBundle))]);
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 5));
    expect(toast.showToast).toHaveBeenCalledWith('Replay failed: controller rejected');
    handle.dispose();
  });

  it('dispose() removes the input from host', () => {
    const handle = createReplayFileImport({ host, replayController: stubController(), toast });
    expect(host.querySelector('[data-testid="replay-file-import-input"]')).not.toBeNull();
    handle.dispose();
    expect(host.querySelector('[data-testid="replay-file-import-input"]')).toBeNull();
  });

  it('file.text() rejection surfaces "Could not read file: <message>" toast', async () => {
    const enterReplay = vi.fn();
    const handle = createReplayFileImport({ host, replayController: stubController(enterReplay), toast });
    const input = host.querySelector<HTMLInputElement>('[data-testid="replay-file-import-input"]')!;
    const evilFile = {
      text: () => Promise.reject(new Error('disk error')),
      name: 'bundle.json',
      size: 0,
    } as unknown as File;
    installInputFiles(input, [evilFile]);
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 5));
    expect(enterReplay).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('Could not read file: disk error');
    handle.dispose();
  });
});
