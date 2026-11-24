export type StoredClip = {
  id: string;
  file: File;
  duration: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
};
export type StoredProject = {
  clips: StoredClip[];
  audio: File | null;
  text: string;
  textColor: string;
  ratio: string;
  effect: 'none' | 'mono' | 'sepia' | 'vivid';
  updatedAt: number;
};
const DB_NAME = 'capcut-studio-local';
const STORE_NAME = 'projects';
const KEY = 'current';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}
export async function readProject(): Promise<StoredProject | null> {
  const db = await openDatabase();
  try {
    return await new Promise<StoredProject | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(KEY);
      request.onsuccess = () => resolve((request.result as StoredProject | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function saveProject(project: StoredProject): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(project, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
