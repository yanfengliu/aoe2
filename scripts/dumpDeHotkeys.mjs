// Prints Age of Empires II: Definitive Edition's default keys from the game's
// own files, for matching this game's keys to DE's (work 142). It reads, never
// launches, the install: `resources/_common/dat/hotkeys.json` and the English
// string table that names each entry. For each entry it prints the
// `definitive` profile's key from `defaults_list`, with Ctrl/Alt/Shift
// (`control`, `alternate` and `shift` in the file; `alternate` read as Alt),
// and the entry's other fields (`context` is a villager build page,
// `button_action_list` the card button, `unit_list` the units it reaches).
//
// Usage: node scripts/dumpDeHotkeys.mjs [GROUP ...]
//   GROUP is a group's data name, e.g. VILLAGER_HOTKEYS, TOWN_CENTER_HOTKEYS,
//   MILITARY_UNITS_HOTKEYS, GAME_COMMAND_HOTKEYS; none prints every group.
//   AOE2DE_DIR overrides the install folder (the folder holding `resources`).
// Bound: the install on this machine, as last patched; strings above 400000
// (newer DLCs) are not in this table and print as "?".

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const install = process.env.AOE2DE_DIR ?? 'C:/Program Files (x86)/Steam/steamapps/common/AoE2DE';
const resources = join(install, 'resources');
const hotkeys = JSON.parse(readFileSync(join(resources, '_common/dat/hotkeys.json'), 'utf8'));
const strings = new Map();
for (const line of readFileSync(join(resources, 'en/strings/key-value/key-value-strings-utf8.txt'), 'utf8').split(/\r?\n/)) {
  const match = /^(\d+)\s+"(.*)"\s*$/.exec(line);
  if (match) strings.set(Number(match[1]), match[2]);
}
const wanted = new Set(process.argv.slice(2));
const MODIFIERS = ['name', 'key', 'control', 'alternate', 'shift'];
const formatKey = (entry) => {
  if (!entry) return '(none)';
  const mods = [entry.control && 'Ctrl', entry.alternate && 'Alt', entry.shift && 'Shift'].filter(Boolean);
  const rest = Object.keys(entry).filter((field) => !MODIFIERS.includes(field));
  return [...mods, entry.key ?? '(unbound)'].join('+') + rest.map((field) => ` ${field}=${JSON.stringify(entry[field])}`).join('');
};
const dump = (kind, group) => {
  if (wanted.size > 0 && !wanted.has(group.data_name)) return;
  console.log(`\n## ${kind} ${group.data_name} (group_id ${group.group_id ?? '-'}, name ${group.name_string_id ?? '-'} "${strings.get(group.name_string_id) ?? ''}")`);
  for (const hotkey of group.hotkey_list) {
    const definitive = (hotkey.defaults_list ?? []).find((entry) => entry.name === 'definitive');
    const extra = Object.keys(hotkey)
      .filter((field) => !['data_name', 'name_string_id', 'defaults_list', 'sequence_id'].includes(field))
      .map((field) => `${field}=${JSON.stringify(hotkey[field])}`).join(' ');
    console.log(`${hotkey.data_name} | ${hotkey.name_string_id} "${strings.get(hotkey.name_string_id) ?? '?'}" | definitive: ${formatKey(definitive)}${extra ? ` | ${extra}` : ''}`);
  }
};
for (const group of hotkeys.shared_hotkey_group_list) dump('shared', group);
for (const group of hotkeys.hotkey_group_list) dump('card', group);
