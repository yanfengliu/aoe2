// The tooltips' copy lives in tooltipCopy.ts (split out in work 148 M1); the
// re-exports keep the import path callers already use.
export {
  formatActionTooltip,
  formatBuildTooltip,
  formatMarketActionTooltip,
  formatResearchTooltip,
  formatResourceCost,
  formatTrainTooltip,
  HUD_CHIP_TOOLTIPS,
  SELECTION_DETAIL_TOOLTIPS,
  withRefusal,
} from './tooltipCopy';

export interface TooltipHandle {
  // Cleanup hook for tests and HUD teardown.
  destroy(): void;
}

let nextTooltipId = 0;

// Slice 11: lightweight tooltip mechanism. Any descendant of `root` with a
// `data-tooltip` attribute surfaces its copy in `tooltipElement` on
// pointerenter or keyboard focus and hides it on pointerleave/focusout.
// Event delegation on the root keeps us cheap even when the selection
// panel re-renders.
export function createTooltipController(
  root: HTMLElement,
  tooltipElement: HTMLElement | null,
): TooltipHandle {
  if (!tooltipElement) {
    return { destroy: () => {} };
  }

  const tooltipId = tooltipElement.id || `hud-tooltip-${nextTooltipId += 1}`;
  tooltipElement.id = tooltipId;
  let pointerHost: Element | null = null;
  // Where the pointer last was, for a redraw to check the control it hovers.
  let pointerPoint: { x: number; y: number } | null = null;
  const notePointer = (event: Event): void => {
    if (event instanceof MouseEvent) pointerPoint = { x: event.clientX, y: event.clientY };
  };
  let focusHost: Element | null = null;
  let describedHost: Element | null = null;
  // Whether the focus that is about to land was put there by a POINTER. A
  // click focuses the button it pressed, and a tooltip owned by that focus
  // outlives the pointer: "Place a House foundation…" stayed over the bar
  // while the player was already out on the map choosing the tile (play-test
  // finding F6, 2026-09-02). DE hides a tooltip when the cursor leaves the
  // button, and a keyboard user still needs one — so only a focus the player
  // reached with the KEYBOARD owns a tooltip. Sticky until the next key,
  // because the selection panel re-renders after a click and restores focus
  // programmatically a frame later.
  // Which CONTROL the pointer last pressed, by its logical id rather than by
  // element identity: the panel re-renders after a click and restores focus to
  // a NEW button carrying the same `data-command`, so an object comparison
  // suppresses the tooltip for one frame and hands it straight back.
  //
  // Deliberately NOT `:focus-visible`: that reads the element's live focus
  // state, and a synthetic `focusin` (the shape every unit test of this
  // controller has) does not focus anything, so the check would answer "not
  // keyboard" for every test and "keyboard" for nothing.
  //
  // Deliberately NOT cleared by a keystroke either: any key would do it, and
  // the panel's own re-render then re-focused the clicked card with the claim
  // released — so pressing a camera key after clicking a card put its tooltip
  // back over the world with the cursor 500px away. The claim is released when
  // focus lands on a DIFFERENT control, which is what a Tab does.
  let pointerPressedKey: string | null = null;

  function tooltipHostKey(host: Element): string {
    // A group panel icon is its unit (work 146 M2): icons of one type share
    // their tooltip's text, and are each a control of their own. A queue icon is
    // its place in the queue (work 148 M1), whose copy changes every tick.
    const member = host.getAttribute('data-selection-member');
    const queueItem = host.getAttribute('data-selection-queue-item');
    return host.getAttribute('data-command')
      ?? host.getAttribute('data-build-page')
      ?? (member === null ? null : `selection-member:${member}`)
      ?? (queueItem === null ? null : `queue-item:${queueItem}`)
      ?? host.getAttribute('data-tooltip')
      ?? '';
  }

  // The control a redraw put in a host's place: the selection panel draws itself
  // again on every tick a building trains, and a tooltip tied to the replaced
  // element vanished under a resting pointer (work 148 M1).
  // Only where the pointer still is: a redraw that moved the control (a group
  // panel's icons close up when one leaves) leaves the pointer over something
  // else (review round 1).
  function sameControl(host: Element): Element | null {
    const key = tooltipHostKey(host);
    const replacement = [...root.querySelectorAll('[data-tooltip]')]
      .find((candidate) => tooltipHostKey(candidate) === key) ?? null;
    if (!replacement || !pointerPoint || typeof document.elementFromPoint !== 'function') return replacement;
    const hit = document.elementFromPoint(pointerPoint.x, pointerPoint.y);
    return hit && replacement.contains(hit) ? replacement : null;
  }

  function clearTooltipDescription(): void {
    if (!describedHost) {
      return;
    }
    const remainingIds = (describedHost.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id.length > 0 && id !== tooltipId);
    if (remainingIds.length > 0) {
      describedHost.setAttribute('aria-describedby', remainingIds.join(' '));
    } else {
      describedHost.removeAttribute('aria-describedby');
    }
    describedHost = null;
  }

  function describeTooltipFor(target: Element): void {
    if (describedHost !== target) {
      clearTooltipDescription();
      describedHost = target;
    }
    const descriptionIds = (target.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id.length > 0);
    if (!descriptionIds.includes(tooltipId)) {
      target.setAttribute('aria-describedby', [...descriptionIds, tooltipId].join(' '));
    }
  }

  function positionTooltip(target: Element): void {
    const tooltip = tooltipElement;
    if (!tooltip) {
      return;
    }
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const menuPanel = target.closest('.hud-game-menu__panel');
    let left: number;
    let top: number;
    if (menuPanel) {
      const panelRect = menuPanel.getBoundingClientRect();
      const rightSpace = viewportWidth - panelRect.right - margin;
      const leftSpace = panelRect.left - margin;
      if (rightSpace >= tooltipRect.width) {
        left = panelRect.right + margin;
        top = rect.top + rect.height * 0.5 - tooltipRect.height * 0.5;
      } else if (leftSpace >= tooltipRect.width) {
        left = panelRect.left - tooltipRect.width - margin;
        top = rect.top + rect.height * 0.5 - tooltipRect.height * 0.5;
      } else {
        left = panelRect.left + panelRect.width * 0.5 - tooltipRect.width * 0.5;
        top = panelRect.top - tooltipRect.height - margin;
        if (top < margin) {
          top = panelRect.bottom + margin;
        }
      }
    } else {
      left = rect.left + rect.width * 0.5 - tooltipRect.width * 0.5;
      // A control in the bottom command bar gets its tooltip above the BAR,
      // not above the control: the bar is a dense grid of cards under a
      // heading row, and a tooltip above a first-row card covered that row —
      // including the "Placing: …" status the click had just revealed.
      const commandBar = target.closest('.hud-panel--selection');
      const above = commandBar ? commandBar.getBoundingClientRect() : rect;
      top = above.top - tooltipRect.height - margin;
      if (top < margin) {
        top = rect.bottom + margin;
      }
    }
    left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));
    // The minimap is the one HUD surface a tooltip must never cover: it is the
    // player's view of the whole map, and the build palette sits right beside
    // it, so a tooltip centred above a right-hand card ran over its frame
    // (defect register, 2026-09-02). Slide left of the frame; when there is no
    // room on that side, go above it. Not for a tooltip anchored in the game
    // menu: the modal's backdrop covers the minimap, and dodging a surface the
    // player cannot see pushed a menu tooltip onto the modal itself at 390px.
    const minimapPanel = menuPanel ? null : root.querySelector('.hud-panel--map');
    if (minimapPanel && !minimapPanel.contains(target)) {
      const avoid = minimapPanel.getBoundingClientRect();
      const overlapsMinimap = avoid.width > 0 && avoid.height > 0
        && left < avoid.right && avoid.left < left + tooltipRect.width
        && top < avoid.bottom && avoid.top < top + tooltipRect.height;
      if (overlapsMinimap) {
        const leftOfMinimap = avoid.left - tooltipRect.width - margin;
        if (leftOfMinimap >= margin) {
          left = Math.min(left, leftOfMinimap);
        } else {
          top = Math.max(margin, avoid.top - tooltipRect.height - margin);
        }
      }
    }
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  // A command's help text (work 148 M2) is DE's: a title line, the verb, the
  // name and the price, drawn bold as DE draws the name (string 26121's
  // "Create <b>Villager<b> (<cost>)"), then what it does, one line each. The
  // text stays the copy whole, so a reader of textContent reads the copy.
  function writeCopy(tooltip: HTMLElement, text: string): void {
    const breakAt = text.indexOf('\n');
    if (breakAt < 0) {
      tooltip.textContent = text;
      return;
    }
    const title = document.createElement('strong');
    title.className = 'hud-tooltip__title';
    title.textContent = text.slice(0, breakAt);
    tooltip.replaceChildren(title, document.createTextNode(text.slice(breakAt)));
  }

  function showTooltipFor(target: Element, text: string): void {
    const tooltip = tooltipElement;
    if (!tooltip || text.trim().length === 0) {
      hideTooltip();
      return;
    }
    describeTooltipFor(target);
    writeCopy(tooltip, text);
    tooltip.dataset.hudTooltipActive = 'true';
    tooltip.setAttribute('aria-hidden', 'false');
    positionTooltip(target);
  }

  function hideTooltip(): void {
    const tooltip = tooltipElement;
    if (!tooltip) {
      return;
    }
    clearTooltipDescription();
    tooltip.dataset.hudTooltipActive = 'false';
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.textContent = '';
  }

  const onPointerOver = (event: PointerEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const host = target?.closest('[data-tooltip]');
    if (!host) {
      return;
    }
    notePointer(event);
    pointerHost = host;
    const text = host.getAttribute('data-tooltip') ?? '';
    showTooltipFor(host, text);
  };

  const onPointerOut = (event: PointerEvent): void => {
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    const target = event.target instanceof Element ? event.target : null;
    const host = target?.closest('[data-tooltip]');
    if (!host) {
      return;
    }
    if (related && host.contains(related)) {
      return;
    }
    if (pointerHost === host) {
      pointerHost = null;
    }
    if (focusHost && root.contains(focusHost)) {
      showTooltipFor(focusHost, focusHost.getAttribute('data-tooltip') ?? '');
    } else {
      hideTooltip();
    }
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const host = target?.closest('[data-tooltip]');
    if (!host) {
      return;
    }
    if (pointerPressedKey !== null && tooltipHostKey(host) === pointerPressedKey) {
      // A clicked control keeps focus — a player may act on it again from the
      // keyboard — but it does not keep a tooltip. Whatever the pointer is
      // hovering still owns one.
      focusHost = null;
      if (!pointerHost) {
        hideTooltip();
      }
      return;
    }
    // Focus reached a different control, so the keyboard owns tooltips again.
    pointerPressedKey = null;
    focusHost = host;
    const text = host.getAttribute('data-tooltip') ?? '';
    showTooltipFor(host, text);
  };

  const onFocusOut = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const host = target?.closest('[data-tooltip]');
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (!host || (related && host.contains(related))) {
      return;
    }
    if (focusHost === host) {
      focusHost = null;
    }

    if (pointerHost && root.contains(pointerHost)) {
      showTooltipFor(pointerHost, pointerHost.getAttribute('data-tooltip') ?? '');
    } else {
      hideTooltip();
    }
  };

  const ownerObserver = new MutationObserver((records) => {
    const changedOutsideTooltip = records.some(
      (record) => record.target !== tooltipElement && !tooltipElement.contains(record.target),
    );
    if (!changedOutsideTooltip) {
      return;
    }
    let ownerDisconnected = false;
    if (pointerHost && !root.contains(pointerHost)) {
      pointerHost = sameControl(pointerHost);
      ownerDisconnected = true;
    }
    if (focusHost && !root.contains(focusHost)) {
      focusHost = null;
      ownerDisconnected = true;
    }
    if (describedHost && !root.contains(describedHost)) {
      ownerDisconnected = true;
    }
    if (!ownerDisconnected) {
      return;
    }
    if (describedHost && root.contains(describedHost)) {
      return;
    }
    if (focusHost) {
      showTooltipFor(focusHost, focusHost.getAttribute('data-tooltip') ?? '');
    } else if (pointerHost) {
      showTooltipFor(pointerHost, pointerHost.getAttribute('data-tooltip') ?? '');
    } else {
      hideTooltip();
    }
  });
  ownerObserver.observe(root, { childList: true, subtree: true });

  // Copy that moves under a tooltip that is showing it: the countdown chip's
  // years and time (work 132) change while the pointer rests on the chip, and a
  // tooltip that kept its first reading would disagree with the time beside it.
  // The HUD rewrites some copy every frame with the same text (a resource
  // chip's), and a rewrite is a mutation record, so only copy that differs from
  // what the tooltip shows is shown again.
  const copyObserver = new MutationObserver((records) => {
    const host = describedHost;
    if (!host || !root.contains(host) || !records.some((record) => record.target === host)) {
      return;
    }
    const copy = host.getAttribute('data-tooltip') ?? '';
    if (copy !== tooltipElement.textContent) {
      showTooltipFor(host, copy);
    }
  });
  copyObserver.observe(root, { attributes: true, attributeFilter: ['data-tooltip'], subtree: true });

  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const host = target?.closest('[data-tooltip]');
    // A press somewhere with no tooltip — the map, a panel's background — does
    // not release the claim: the click that ENDS placement is such a press, and
    // releasing it there would let the panel's next re-render hand the card
    // its tooltip back.
    // Touch is exempt: a finger has no hover, so a tap is the ONLY way a touch
    // user can ask what a tile is, and suppressing the focus tooltip there
    // would leave them with an icon and no name at all.
    if (host && event.pointerType !== 'touch') {
      pointerPressedKey = tooltipHostKey(host);
    }
  };

  // A redraw can put a new element in the hovered control's place while the
  // browser still holds the old one as hovered, so the pointer's leaving
  // reaches no listener here: any move off the control releases it, as a
  // pointerout would (work 148 M1).
  const onPointerMove = (event: PointerEvent): void => {
    notePointer(event);
    if (!pointerHost || (event.target instanceof Node && pointerHost.contains(event.target))) {
      return;
    }
    pointerHost = null;
    if (focusHost && root.contains(focusHost)) {
      showTooltipFor(focusHost, focusHost.getAttribute('data-tooltip') ?? '');
    } else {
      hideTooltip();
    }
  };

  root.addEventListener('pointerover', onPointerOver);
  root.addEventListener('pointerout', onPointerOut);
  // Watched on the document, not on the HUD: the press that decides whether a
  // focus is a pointer focus can land anywhere on the page.
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointermove', onPointerMove, true);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  let resizeFrame: number | null = null;
  const repositionActiveTooltip = (): void => {
    if (describedHost && root.contains(describedHost)) {
      positionTooltip(describedHost);
    }
  };
  const repositionAfterResponsiveLayout = (): void => {
    repositionActiveTooltip();
    if (typeof window.requestAnimationFrame !== 'function') {
      return;
    }
    if (resizeFrame !== null) {
      window.cancelAnimationFrame(resizeFrame);
    }
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      repositionActiveTooltip();
    });
  };
  window.addEventListener('resize', repositionAfterResponsiveLayout);
  window.addEventListener('scroll', repositionActiveTooltip, true);

  return {
    destroy: () => {
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', repositionAfterResponsiveLayout);
      window.removeEventListener('scroll', repositionActiveTooltip, true);
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = null;
      }
      ownerObserver.disconnect();
      copyObserver.disconnect();
      pointerHost = null;
      focusHost = null;
      pointerPressedKey = null;
      hideTooltip();
    },
  };
}
