import { describe, expect, it } from 'vitest';

import { hasSingleThreeIdentity } from '../../src/rendering/voxel/threeIdentity';

describe('Three runtime identity', () => {
  it('shares the consumer Three constructor with the linked voxel package', () => {
    expect(hasSingleThreeIdentity()).toBe(true);
  });
});
