import { CustomFileItem } from "@/types";
import { detectFileType } from "@/lib/storage/config-files-storage";

export interface ImportedFileResult {
  file: File;
  relativePath: string;
}

const WELL_KNOWN_MC_FOLDERS = new Set([
  "config",
  "configs",
  "defaultconfigs",
  "kubejs",
  "resourcepacks",
  "datapacks",
  "shaderpacks",
  "mods",
  "patchouli_books",
  "openloader",
  "scripts",
  "structures",
  "saves",
  "schematics",
]);

const TEXT_EXTENSIONS = new Set([
  "txt", "json", "toml", "ini", "cfg", "conf", "properties", "yaml", "yml",
  "js", "ts", "mjs", "cjs", "lua", "py", "sh", "cmd", "bat", "mcmeta",
  "snbt", "md", "css", "html", "xml", "log", "csv", "json5", "zs"
]);

/**
 * Normalizes a relative path and strips wrapper folders (e.g. "overrides/" or "MyPack/" if it contains standard folders).
 */
export function normalizeImportPaths(rawEntries: { file: File; path: string }[]): { file: File; cleanPath: string }[] {
  if (rawEntries.length === 0) return [];

  const cleanedEntries = rawEntries.map(e => ({
    file: e.file,
    path: e.path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "")
  }));

  // Analyze top-level segments
  const topSegments = new Set<string>();
  cleanedEntries.forEach(e => {
    const parts = e.path.split("/");
    if (parts.length > 1) {
      topSegments.add(parts[0]);
    }
  });

  // If all files share a single wrapper directory
  if (topSegments.size === 1) {
    const wrapper = Array.from(topSegments)[0].toLowerCase();
    
    // Check if wrapper is explicitly "overrides" or "override"
    const isOverrideWrapper = wrapper === "overrides" || wrapper === "override";

    // Or check if the immediate subdirectories under this wrapper are well-known Minecraft folders
    let hasStandardSubfolder = false;
    for (const e of cleanedEntries) {
      const parts = e.path.split("/");
      if (parts.length > 2 && WELL_KNOWN_MC_FOLDERS.has(parts[1].toLowerCase())) {
        hasStandardSubfolder = true;
        break;
      }
    }

    if (isOverrideWrapper || hasStandardSubfolder) {
      // Strip top-level wrapper
      return cleanedEntries.map(e => {
        const parts = e.path.split("/");
        parts.shift(); // remove wrapper
        return {
          file: e.file,
          cleanPath: `/${parts.join("/")}`
        };
      });
    }
  }

  return cleanedEntries.map(e => ({
    file: e.file,
    cleanPath: `/${e.path}`
  }));
}

/**
 * Recursively read directory entries from a DataTransferItem (via webkitGetAsEntry).
 * Handles Chrome's 100-item chunk pagination in readEntries.
 */
export async function readDirectoryRecursive(dirEntry: any, currentPath: string = ""): Promise<ImportedFileResult[]> {
  const dirReader = dirEntry.createReader();
  const allEntries: any[] = [];

  // Chrome paginates readEntries() up to 100 entries per call. Loop until empty.
  const readBatch = async (): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      dirReader.readEntries(
        (entries: any[]) => resolve(entries),
        (err: any) => reject(err)
      );
    });
  };

  let batch: any[];
  do {
    batch = await readBatch();
    allEntries.push(...batch);
  } while (batch.length > 0);

  const results: ImportedFileResult[] = [];

  for (const entry of allEntries) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        entry.file(
          (f: File) => resolve(f),
          (err: any) => reject(err)
        );
      });
      results.push({ file, relativePath: entryPath });
    } else if (entry.isDirectory) {
      const subResults = await readDirectoryRecursive(entry, entryPath);
      results.push(...subResults);
    }
  }

  return results;
}

/**
 * Extract files from DragEvent DataTransfer items (supports multiple folders and files simultaneously).
 */
export async function extractFilesFromDrop(dataTransfer: DataTransfer): Promise<ImportedFileResult[]> {
  const results: ImportedFileResult[] = [];
  const items = Array.from(dataTransfer.items || []);

  for (const item of items) {
    if (item.kind !== "file") continue;
    
    // Check if webkitGetAsEntry is available
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) {
      if (entry.isFile) {
        const file = item.getAsFile();
        if (file) {
          results.push({ file, relativePath: file.name });
        }
      } else if (entry.isDirectory) {
        const dirFiles = await readDirectoryRecursive(entry, entry.name);
        results.push(...dirFiles);
      }
    } else {
      // Fallback for browsers without webkitGetAsEntry
      const file = item.getAsFile();
      if (file) {
        results.push({ file, relativePath: file.name });
      }
    }
  }

  return results;
}

/**
 * Convert a File object into CustomFileItem (handling text vs binary data).
 */
export async function processFileToCustomItem(file: File, targetPath: string): Promise<CustomFileItem> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isText = TEXT_EXTENSIONS.has(ext);
  const detectedType = detectFileType(file.name);

  let content: string | undefined = undefined;
  let isBinary = false;

  if (isText) {
    content = await file.text();
  } else {
    // Binary file (texture, dat, nbt, ogg, etc.): read as Data URL (base64)
    isBinary = true;
    content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const cleanTargetPath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const now = new Date().toISOString();

  return {
    id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: file.name,
    targetPath: cleanTargetPath,
    type: detectedType,
    content,
    storageLocation: "local_browser",
    createdAt: now,
    updatedAt: now,
    size: file.size,
    isBinary,
  };
}
