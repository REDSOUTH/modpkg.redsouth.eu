import { CustomFileItem, CustomFileType, ConfigFileItem, ConfigFileType } from "@/types";
import { getPackData, savePackData, GLOBAL_CUSTOM_FILES_KEY } from "./package-storage";

const STORAGE_KEY = GLOBAL_CUSTOM_FILES_KEY;

export function getCustomFileItems(): CustomFileItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load custom file items", e);
    return [];
  }
}
export const getConfigFileItems = getCustomFileItems;

export function saveCustomFileItem(
  payload: Omit<CustomFileItem, "id" | "createdAt" | "updatedAt">
): CustomFileItem {
  const items = getCustomFileItems();
  const now = new Date().toISOString();
  const newItem: CustomFileItem = {
    ...payload,
    id: `cfg-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([newItem, ...items]));
  return newItem;
}
export const saveConfigFileItem = saveCustomFileItem;

export function updateCustomFileItem(
  id: string,
  updates: Partial<Omit<CustomFileItem, "id" | "createdAt">>
): CustomFileItem | null {
  const items = getCustomFileItems();
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return items[index];
}
export const updateConfigFileItem = updateCustomFileItem;

export function deleteCustomFileItem(id: string): void {
  const items = getCustomFileItems().filter((i) => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
export const deleteConfigFileItem = deleteCustomFileItem;

// Package-exclusive custom files storage (stored inside per-modpkg JSON object: modpkg_pack_${packId})
export function getPackageCustomFileItems(packId: string): CustomFileItem[] {
  const packData = getPackData(packId);
  return packData.customFiles || [];
}

export function savePackageCustomFileItem(
  packId: string,
  payload: Omit<CustomFileItem, "id" | "createdAt" | "updatedAt">
): CustomFileItem {
  const packData = getPackData(packId);
  const now = new Date().toISOString();
  const newItem: CustomFileItem = {
    ...payload,
    id: `cfg-pkg-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  };
  packData.customFiles = [newItem, ...(packData.customFiles || [])];
  savePackData(packId, packData);
  return newItem;
}

export function updatePackageCustomFileItem(
  packId: string,
  id: string,
  updates: Partial<CustomFileItem>
): CustomFileItem | null {
  const packData = getPackData(packId);
  const items = packData.customFiles || [];
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
  packData.customFiles = items;
  savePackData(packId, packData);
  return items[index];
}

export function deletePackageCustomFileItem(packId: string, id: string): void {
  const packData = getPackData(packId);
  packData.customFiles = (packData.customFiles || []).filter(i => i.id !== id);
  savePackData(packId, packData);
}

export const CUSTOM_FILE_TYPES: { value: CustomFileType; label: string }[] = [
  { value: "config", label: "Config" },
  { value: "script", label: "Script" },
  { value: "data", label: "Data" },
  { value: "multimedia", label: "Multimedia" },
  { value: "other", label: "Other" },
];
export const CONFIG_FILE_TYPES = CUSTOM_FILE_TYPES;

export function detectFileType(filename: string): CustomFileType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["cfg", "toml", "txt", "ini", "conf", "properties"].includes(ext)) return "config";
  if (["js", "ts", "lua", "py", "sh", "zs"].includes(ext)) return "script";
  if (["json", "yaml", "yml", "xml", "nbt", "dat"].includes(ext)) return "data";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "mp4", "webm", "mp3", "wav", "ogg"].includes(ext)) return "multimedia";
  return "other";
}

export function detectMonacoLanguage(targetPath: string): string {
  const ext = targetPath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", ts: "typescript", json: "json",
    lua: "lua", py: "python", sh: "shell",
    toml: "toml", yaml: "yaml", yml: "yaml",
    xml: "xml", zs: "javascript", md: "markdown",
  };
  return map[ext] ?? "plaintext";
}

export const UNSUPPORTED_BINARY_EXTENSIONS = new Set([
  // Archives & packages
  "jar", "zip", "tar", "gz", "7z", "rar", "bz2", "pak",
  // Minecraft binary formats
  "dat", "dat_old", "nbt", "mca", "mcr", "schem", "schematic",
  // Executables & libraries
  "class", "exe", "dll", "so", "dylib", "bin",
  // Fonts
  "ttf", "otf", "woff", "woff2",
]);

export const MEDIA_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"]);
export const MEDIA_AUDIO_EXTS = new Set(["mp3", "ogg", "wav", "flac"]);
export const MEDIA_VIDEO_EXTS = new Set(["mp4", "webm", "ogv"]);

export function getFileExtension(filename: string): string {
  return (filename.split(".").pop() || "").toLowerCase();
}

export function isMediaFile(file: CustomFileItem | null | undefined): boolean {
  if (!file) return false;
  if (file.type === "multimedia") return true;
  const ext = getFileExtension(file.name || file.targetPath || "");
  return MEDIA_IMAGE_EXTS.has(ext) || MEDIA_AUDIO_EXTS.has(ext) || MEDIA_VIDEO_EXTS.has(ext);
}

export function isUnsupportedBinary(file: CustomFileItem | null | undefined): boolean {
  if (!file) return false;
  const ext = getFileExtension(file.name || file.targetPath || "");
  if (UNSUPPORTED_BINARY_EXTENSIONS.has(ext)) return true;
  if (file.isBinary && !isMediaFile(file)) return true;
  return false;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

