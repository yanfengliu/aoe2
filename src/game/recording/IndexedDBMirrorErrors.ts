// Spec 2 (annotation-ui v0.1.5) AO-7c: typed errors thrown by
// IndexedDBMirror.reconstructBundle and related read APIs. Distinct
// classes so consumers can switch on the error type and surface a
// meaningful message.

export class SessionNotFoundError extends Error {
  override readonly name = 'SessionNotFoundError';
  constructor(public readonly sessionId: string) {
    super(`session ${sessionId} not found in IndexedDB`);
  }
}

export class SchemaMismatchError extends Error {
  override readonly name = 'SchemaMismatchError';
  constructor(
    public readonly sessionId: string,
    public readonly storedVersion: number,
    public readonly expectedVersion: number,
  ) {
    super(
      `session ${sessionId} schema version ${storedVersion} differs from current ${expectedVersion}`,
    );
  }
}

export class IncompleteSessionError extends Error {
  override readonly name = 'IncompleteSessionError';
  constructor(
    public readonly sessionId: string,
    public readonly reason: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(`session ${sessionId} is incomplete: ${reason}`);
  }
}
