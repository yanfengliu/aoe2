// Work 146: Definitive Edition caps a selection at 60 units. No file in DE's
// install states the number; DE players name it ("What was the reasoning for a
// sixty-unit selection limit?", forums.ageofempires.com t/226116, 2023-03-03,
// and t/72939, 2020: DE's select-all military key "doesn't select all military
// units if there are more than 60"), and the openage reverse engineering gives
// AoE2 HD's as 60 (AoK's was 40). Every way to select keeps at most this many:
// a box, a double-click, a select-all or go-to key, a control group, Shift.
// Which units DE keeps when a gesture offers more is unsourced; here the first
// 60 in the order the gesture lists them, and an addition keeps what was
// already selected (spec §9.4).
export const SELECTION_LIMIT = 60;
