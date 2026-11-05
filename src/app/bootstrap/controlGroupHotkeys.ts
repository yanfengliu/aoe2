// DE's control-group keys (work 142 M2b-2b-2b), the `definitive` defaults of
// GROUP_COMMAND_HOTKEYS in the install's `hotkeys.json` (`node
// scripts/dumpDeHotkeys.mjs GROUP_COMMAND_HOTKEYS`), cited in spec §14.2:
//  - Ctrl with 1-9 and 0 creates groups 1-10 (CREATE_GROUP1 19244 ... 10 181037),
//    the digit alone selects one (SELECT_GROUP1 19254 ... 10 181048), Shift with
//    it adds the group to the selection (APPEND_GROUP1 181079 ... 10 181088;
//    update 36202 made that DE's default), and Ctrl+Shift
//    with 1-9 selects and centres (SELECT_CENTER_GROUP1 181059 ...), group 10's
//    being Ctrl+Shift+F10 (181068);
//  - groups 11-20 are the same keys with Alt (the entries' `alternate`; a DE
//    player reads "Alt-1 through Alt-0" for them off DE's menu),
//    Ctrl+Alt+Shift+F10 centring group 20;
//  - U ungroups the selection (UNGROUP_CONTROL_GROUP, 19099).
// A digit is the main row's physical key (`KeyboardEvent.code`, DE's VK_1 ...
// VK_0): Shift+1 types "!" on a US layout, and the numpad's digits are other
// keys in DE (VK_NUMPAD1), as they are here now.

import type { HotkeyHandler, HotkeySpec } from '../../game/control/HotkeyRegistry';
import { controlGroupIndex } from '../../game/simulation/bridge/controlGroupOps';
import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';
import { centreOnObject, type CentringViewLike } from './goToObject';

/** A second tap of the same group key inside this window centres the camera.
 *  Measured between the two keydowns' own `timeStamp`s, never on a clock read
 *  in the handler: a slow frame between two quick taps delays the second one's
 *  handling, and the game used to read that as a slow second tap (2026-09-23,
 *  tests/browser/control-group-double-tap.spec.ts). DE's files hold only the
 *  centring key; aoe2db.com's hotkey page: "Press the number twice to center
 *  the screen on it." */
export const CONTROL_GROUP_DOUBLE_TAP_MS = 450;

interface HotkeyRegistryLike {
  register(spec: HotkeySpec, handler: HotkeyHandler): void;
}

export function registerControlGroupHotkeys(
  hotkeyRegistry: HotkeyRegistryLike,
  // A getter: createApp swaps the bridge on save-load.
  bridgeRef: () => SimulationBridge,
  view: CentringViewLike,
): void {
  const centre = (): void => {
    const bridge = bridgeRef();
    centreOnObject(bridge, view, bridge.getSelectionState().selectedEntityId);
  };
  let lastRecall = { group: -1, atMs: 0 };
  const select = (group: number, event: KeyboardEvent): void => {
    if (!bridgeRef().recallControlGroup(group)) return;
    const tappedAt = event.timeStamp;
    if (lastRecall.group === group && tappedAt - lastRecall.atMs < CONTROL_GROUP_DOUBLE_TAP_MS) centre();
    lastRecall = { group, atMs: tappedAt };
  };
  const selectAndCentre = (group: number): void => {
    if (bridgeRef().recallControlGroup(group)) centre();
  };
  for (const alt of [false, true]) {
    for (let digit = 0; digit <= 9; digit += 1) {
      const group = controlGroupIndex(digit, alt);
      const code = `Digit${digit}`;
      hotkeyRegistry.register({ code, ctrl: true, alt }, () => { bridgeRef().assignControlGroup(group); });
      hotkeyRegistry.register({ code, alt }, (event) => { select(group, event); });
      hotkeyRegistry.register({ code, shift: true, alt }, () => { bridgeRef().appendControlGroupToSelection(group); });
      // DE centres groups 10 and 20 on F10, not on 0.
      if (digit !== 0) hotkeyRegistry.register({ code, ctrl: true, shift: true, alt }, () => { selectAndCentre(group); });
    }
    hotkeyRegistry.register({ key: 'F10', ctrl: true, shift: true, alt }, () => { selectAndCentre(controlGroupIndex(0, alt)); });
  }
  hotkeyRegistry.register({ key: 'u' }, () => { bridgeRef().ungroupSelection(); });
}
