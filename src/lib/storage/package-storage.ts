import { PackSettings, InstalledItem, CustomContentItem, CustomFileItem, PackReleaseData } from "@/types";
import { savePackDataIdb, deletePackDataIdb, getPackDataIdb } from "./indexeddb-storage";

export const PACKAGES_INDEX_KEY = "modpkg_packages_index";
export const GLOBAL_CUSTOM_CONTENT_KEY = "modpkg_custom_content_global";
export const GLOBAL_CUSTOM_FILES_KEY = "modpkg_custom_files_global";

export interface PackExclusiveData {
  id: string;
  installedContent: InstalledItem[];
  customContent: CustomContentItem[];
  customFiles: CustomFileItem[];
  releases?: Record<string, PackReleaseData>;
  verifiedItems?: string[];
}

export function getPackagesIndex(): PackSettings[] {
  try {
    const raw = localStorage.getItem(PACKAGES_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load packages index", e);
    return [];
  }
}

export function savePackagesIndex(packages: PackSettings[]): void {
  try {
    localStorage.setItem(PACKAGES_INDEX_KEY, JSON.stringify(packages));
  } catch (e) {
    console.error("Failed to save packages index", e);
  }
}

export function getPackData(packId: string): PackExclusiveData {
  try {
    const raw = localStorage.getItem(`modpkg_pack_${packId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        id: packId,
        installedContent: parsed.installedContent || [],
        customContent: parsed.customContent || [],
        customFiles: parsed.customFiles || [],
        releases: parsed.releases || {},
        verifiedItems: parsed.verifiedItems || [],
      };
    }
  } catch (e) {
    console.error(`Failed to load pack data for ${packId} from localStorage`, e);
  }
  return {
    id: packId,
    installedContent: [],
    customContent: [],
    customFiles: [],
    releases: {},
    verifiedItems: [],
  };
}

export async function getPackDataAsync(packId: string): Promise<PackExclusiveData> {
  try {
    const idbData = await getPackDataIdb(packId);
    if (idbData) {
      return idbData;
    }
  } catch (e) {
    console.warn(`IndexedDB read failed for ${packId}, falling back to localStorage:`, e);
  }
  return getPackData(packId);
}

export function savePackData(packId: string, data: PackExclusiveData): void {
  // Always save full data to IndexedDB asynchronously (no quota limit)
  savePackDataIdb(packId, data).catch((err) => {
    console.error(`Failed to save pack data to IndexedDB for ${packId}:`, err);
  });

  // Also attempt to save to localStorage for synchronous fallbacks, catching any QuotaExceededError
  try {
    localStorage.setItem(`modpkg_pack_${packId}`, JSON.stringify(data));
  } catch (e) {
    console.warn(
      `localStorage quota exceeded for pack ${packId}. Pack is safely persisted in IndexedDB.`,
      e
    );
  }
}

export function deletePackStorage(packId: string): void {
  deletePackDataIdb(packId).catch((err) => {
    console.error(`Failed to delete pack from IndexedDB for ${packId}:`, err);
  });

  try {
    localStorage.removeItem(`modpkg_pack_${packId}`);
    localStorage.removeItem(`modpkg_hidden_custom_${packId}`);
  } catch (e) {
    console.error(`Failed to delete pack data from localStorage for ${packId}`, e);
  }
}
