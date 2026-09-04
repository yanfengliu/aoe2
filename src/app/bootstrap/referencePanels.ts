// The two REFERENCE panels a player opens mid-match to look something up: the
// technology tree (§11.3) and the civilizations compendium (§11.14).
//
// They are wired together, and apart from `createApp`, because they are one
// role and they share every rule that governs it — each opens from its own
// game-menu button AND a function key, each opens OVER the menu so closing it
// returns there and the menu's pause holds, and each is torn down with the
// app. Adding the second one inline pushed `createApp.ts` past the repository's
// 500-line ceiling, which is the budget test asking for exactly this split.
//
// The function keys already spoken for: F2 is the debug overlay, F3 the DE
// pause key. F1 and F4 are these.

import { createCivCompendium } from '../../ui/hud/civCompendium';
import { createTechTreePanel } from '../../ui/hud/techTreePanel';

interface HotkeyRegistryLike {
  register(binding: { key: string }, handler: () => void): void;
}

interface ReferencePanel {
  open(): void;
  toggle(): void;
  destroy(): void;
}

export interface ReferencePanelsHandle {
  /** Tears both panels out of the HUD. */
  dispose(): void;
}

export function mountReferencePanels(deps: {
  hudRoot: HTMLElement;
  hotkeyRegistry: HotkeyRegistryLike;
  /** The civilization BOTH panels describe — the human player's. */
  getCivilization: () => string;
}): ReferencePanelsHandle {
  const { hudRoot, hotkeyRegistry, getCivilization } = deps;

  const wire = (
    panel: ReferencePanel,
    menuButton: string,
    key: string,
  ): ReferencePanel => {
    hudRoot.querySelector(`[data-hud="${menuButton}"]`)?.addEventListener('click', () => {
      panel.open();
    });
    hotkeyRegistry.register({ key }, () => { panel.toggle(); });
    return panel;
  };

  const panels = [
    wire(createTechTreePanel(hudRoot, { getCivilization }), 'menu-tech-tree', 'F1'),
    wire(createCivCompendium(hudRoot, { getCivilization }), 'menu-civilizations', 'F4'),
  ];

  return {
    dispose: () => { for (const panel of panels) panel.destroy(); },
  };
}
