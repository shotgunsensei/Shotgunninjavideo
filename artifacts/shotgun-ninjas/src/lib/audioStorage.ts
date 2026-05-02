const DB_NAME = "shotgun-ninjas-audio";
const STORE = "files";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredAudio {
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
}

export async function putAudio(projectId: string, audio: StoredAudio): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(audio, projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAudio(projectId: string): Promise<StoredAudio | null> {
  const db = await openDb();
  const result = await new Promise<StoredAudio | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(projectId);
    req.onsuccess = () => resolve((req.result as StoredAudio) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteAudio(projectId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
