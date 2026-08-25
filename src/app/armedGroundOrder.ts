// M6 control: which ground order the next left click will spend.
//
// AoE2's attack-move and patrol share one interaction — press a key, then
// click where you want it. That means one piece of state, not a flag per order
// type: with two booleans, pressing A and then P leaves both set and the click
// has to arbitrate. Held here rather than in the view so the hotkey registry
// and the pointer controller are looking at the same thing.

export type GroundOrderKind = 'attack-move' | 'patrol' | 'attack-ground';

export class ArmedGroundOrder {
  private armed: GroundOrderKind | null = null;

  /** Arms `kind`, replacing whatever was armed before. */
  arm(kind: GroundOrderKind): void {
    this.armed = kind;
  }

  /** What the next left click will spend, or null. */
  get(): GroundOrderKind | null {
    return this.armed;
  }

  /** Clears the arming — a spent click, a right-click, or Escape. */
  disarm(): void {
    this.armed = null;
  }
}
