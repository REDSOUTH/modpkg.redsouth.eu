import { PackExclusiveData } from "./package-storage";

const DB_NAME = "modpkg_db";
const DB_VERSION = 1;
const PACK_STORE = "pack_data";

let dbPromise: Promise<IDBDatabase> | null = null;

export function getIndexedDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not supported in this environment"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(PACK_STORE)) {
          db.createObjectStore(PACK_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error("IndexedDB open error:", request.error);
        reject(request.error);
      };
    });
  }

  return dbPromise;
}

/**
 * Get pack data from IndexedDB with fallback/migration from localStorage
 */
export async function getPackDataIdb(packId: string): Promise<PackExclusiveData | null> {
  try {
    const db = await getIndexedDB();
    return await new Promise<PackExclusiveData | null>((resolve, reject) => {
      const transaction = db.transaction([PACK_STORE], "readonly");
      const store = transaction.objectStore(PACK_STORE);
      const request = store.get(packId);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve(result as PackExclusiveData);
        } else {
          // Check if it exists in localStorage and migrate it
          const localRaw = localStorage.getItem(`modpkg_pack_${packId}`);
          if (localRaw) {
            try {
              const parsed = JSON.parse(localRaw);
              const migratedData: PackExclusiveData = {
                id: packId,
                installedContent: parsed.installedContent || [],
                customContent: parsed.customContent || [],
                customFiles: parsed.customFiles || [],
                releases: parsed.releases || {},
              };
              // Persist to IDB in background
              savePackDataIdb(packId, migratedData).catch(err => 
                console.warn("Background migration to IDB failed:", err)
              );
              resolve(migratedData);
              return;
            } catch (err) {
              console.error("Error migrating localStorage data to IDB:", err);
            }
          }
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error(`Error reading pack data for ${packId} from IDB:`, request.error);
        reject(request.error);
      };
    });
  } catch (e) {
    console.error(`Failed to get pack data from IndexedDB for ${packId}:`, e);
    return null;
  }
}

/**
 * Save pack data to IndexedDB
 */
export async function savePackDataIdb(packId: string, data: PackExclusiveData): Promise<void> {
  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([PACK_STORE], "readwrite");
      const store = transaction.objectStore(PACK_STORE);
      const request = store.put({ ...data, id: packId });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error(`Error saving pack data for ${packId} to IDB:`, request.error);
        reject(request.error);
      };
    });
  } catch (e) {
    console.error(`Failed to save pack data to IndexedDB for ${packId}:`, e);
  }
}

/**
 * Delete pack data from IndexedDB
 */
export async function deletePackDataIdb(packId: string): Promise<void> {
  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([PACK_STORE], "readwrite");
      const store = transaction.objectStore(PACK_STORE);
      const request = store.delete(packId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error(`Error deleting pack data for ${packId} from IDB:`, request.error);
        reject(request.error);
      };
    });
  } catch (e) {
    console.error(`Failed to delete pack data from IndexedDB for ${packId}:`, e);
  }
}
