// Low-level IndexedDB read primitives (get / getAll / prefix-range getAll /
// count) shared by IndexedDBMirror's read and prune paths.

export function _read<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error('read failed'));
  });
}

export function _readAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as T[]);
    req.onerror = () => reject(req.error ?? new Error('readAll failed'));
  });
}

export function _readAllByPrefix<T>(
  db: IDBDatabase,
  storeName: string,
  sessionId: string,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const range = IDBKeyRange.bound([sessionId], [sessionId, '￿']);
    const req = store.getAll(range);
    req.onsuccess = () => resolve((req.result ?? []) as T[]);
    req.onerror = () => reject(req.error ?? new Error('readAllByPrefix failed'));
  });
}

export function _countByPrefix(
  db: IDBDatabase,
  storeName: string,
  sessionId: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const range = IDBKeyRange.bound([sessionId], [sessionId, '￿']);
    const req = store.count(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('countByPrefix failed'));
  });
}
