/**
 * MODPKG Central Type Definitions & Reusable Interfaces
 */

// ==========================================
// 1. Pack & Context Interfaces
// ==========================================

export type FocusField = "name" | "version" | "mcVersion" | "loader" | null;

export interface PackSettings {
  id: string;
  name: string;
  slug?: string;
  mcVersion: string;
  loader: string;
  loaderVersion?: string;
  versions: string[];
  currentVersion: string;
  description: string;
  author?: string;
  authorId?: string;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

export interface PackReleaseData {
  releaseId: string;
  minecraft: string;
  loader: {
    type: string;
    version?: string;
  };
  installedContent: InstalledItem[];
  customFiles: CustomFileItem[];
  publishedAt?: string;
  updatedAt?: string;
  verifiedItems?: string[];
}

export interface ModpkgExportMetadata {
  projectId: string;
  versionId: string;
  name: string;
  description: string;
  author: string;
  authorId?: string;
}

export interface ModpkgExportDependencies {
  minecraft: string;
  loader: {
    type: string;
    version?: string;
  };
}

export interface ModpkgModrinthItem {
  id: string;
  name: string;
  type: string; // "mod" | "resourcepack" | "shader" | "datapack" | "world"
  versionId: string;
  versionName?: string;
  fileName?: string;
  url?: string;
  hashes?: {
    sha1?: string;
    sha512?: string;
  };
}
export type ModpkgModrinthMod = ModpkgModrinthItem;

export interface ModpkgCurseforgeItem {
  id: string | number;
  name?: string;
  type: string; // "mod" | "resourcepack" | "shader" | "datapack" | "world"
  fileId: string | number;
  fileName?: string;
  url?: string;
  hashes?: {
    sha1?: string;
    md5?: string;
  };
}
export type ModpkgCurseforgeMod = ModpkgCurseforgeItem;

export interface ModpkgCustomItem {
  id?: string;
  name: string;
  type: string; // "mod" | "resourcepack" | "shader" | "datapack" | "world"
  fileName?: string;
  url?: string;
  targetPath?: string;
  hashes?: {
    sha1?: string;
  };
}
export type ModpkgDirectUrlMod = ModpkgCustomItem;

export interface ModpkgOverride {
  path: string;
  type: "text" | "base64" | "url";
  content?: string;
  url?: string;
  fileType?: string;
}

export interface ModpkgExportFile {
  formatVersion: 1;
  generator: string;
  exportedAt: string;
  metadata: ModpkgExportMetadata;
  dependencies: ModpkgExportDependencies;
  content: {
    modrinth: ModpkgModrinthItem[];
    curseforge: ModpkgCurseforgeItem[];
    custom: ModpkgCustomItem[];
  };
  mods?: {
    modrinth?: any[];
    curseforge?: any[];
    directUrls?: any[];
    custom?: any[];
  };
  overrides: ModpkgOverride[];
}

export interface InstalledItem {
  id: string; // Project ID (CurseForge or Modrinth)
  name: string;
  provider: "modrinth" | "curseforge" | "custom" | "local_override" | "all";
  iconUrl: string;
  versionId: string; // Specific version ID or "latest"
  versionName?: string; // Human-readable version name
  contentType: string;
  path?: string; // Optional path for overrides
  downloadUrl?: string;
  author?: string;
  mcVersion?: string;
  loader?: string;
  targetPath?: string;
  fileName?: string;
  hashes?: Record<string, string>;
  storageLocation?: CustomStorageLocation;
  isPackageOnly?: boolean;
}

export type CustomStorageLocation = "local_browser" | "account_cloud";

export type CustomFileType = "config" | "script" | "data" | "multimedia" | "other";
export type ConfigFileType = CustomFileType;

export interface CustomFileItem {
  id: string;
  name: string;           // "Mis ajustes de gráficos"
  targetPath: string;     // "/" por defecto (raíz del paquete)
  type: CustomFileType;
  content?: string;       // texto inline editado con Monaco o base64
  sourceUrl?: string;     // URL externa descargable (alternativa a content)
  storageLocation: CustomStorageLocation;
  createdAt: string;
  updatedAt: string;
  size?: number;          // tamaño en bytes
  isBinary?: boolean;     // true si es archivo binario codificado en base64
}
export type ConfigFileItem = CustomFileItem;

export interface CustomContentItem {
  id: string;
  name: string;
  contentType: string; // mod, resourcepack, shader, datapack, world, override
  downloadUrl: string;
  author?: string;
  mcVersion?: string;
  loader?: string;
  targetPath?: string;
  storageLocation: CustomStorageLocation;
  createdAt: string;
}

export interface ModVersion {
  id: string;
  name: string;
  stable: boolean;
  recommended: boolean;
  downloadUrl?: string;
  fileName?: string;
}

export interface Loader {
  id: string;
  name: string;
}

export interface MojangVersion {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha" | string;
  url?: string;
  time?: string;
  releaseTime?: string;
}

export interface ModrinthLoaderTag {
  name: string;
  supported_project_types?: string[];
}

export interface PackContextType {
  packSettings: PackSettings;
  packagesList: PackSettings[];
  activePackId: string | null;
  createPack: (packData: Omit<PackSettings, "id" | "versions" | "currentVersion"> & { id?: string; version?: string }) => PackSettings;
  importPack: (parsedJson: any) => PackSettings;
  switchPack: (packId: string) => void;
  deletePack: (packId: string) => void;
  updatePackSettings: (newSettings: Partial<PackSettings>, targetPackId?: string) => void;
  createNewVersion: (versionName: string, copyFromVersion?: string, targetPackId?: string) => void;
  deleteVersion: (versionToDelete: string, targetPackId?: string) => void;
  getMinecraftVersions: (showAll?: boolean) => string[];
  getLoaders: (showAll?: boolean) => Loader[];
  loaders: Loader[];
  isLoadingVersions: boolean;
  installedContent: InstalledItem[];
  addContent: (item: InstalledItem) => void;
  removeContent: (id: string) => void;
  customFiles: CustomFileItem[];
  addCustomFile: (file: CustomFileItem) => void;
  addCustomFilesBatch: (files: CustomFileItem[]) => void;
  updateCustomFile: (file: CustomFileItem) => void;
  removeCustomFile: (id: string) => void;
  removeCustomFilesBatch: (ids: string[]) => void;
  removeCustomFolder: (folderPath: string) => void;
  isCreatePackModalOpen: boolean;
  setIsCreatePackModalOpen: (open: boolean) => void;
  verifiedItems: string[];
  setVerifiedItems: (items: string[] | ((prev: string[]) => string[])) => void;
  isVerifying: boolean;
  verifyPackContents: () => Promise<{ verifiedCount: number; totalCount: number; failedNames: string[] }>;
}

// ==========================================
// 2. Component Props Interfaces
// ==========================================

export interface PackSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
  focusField?: FocusField;
  isCreateMode?: boolean;
  pack?: PackSettings | null;
}

export interface EditorTopbarProps {
  onOpenSettings: (field?: FocusField, isCreate?: boolean) => void;
}

export interface FieldLabelProps {
  children: React.ReactNode;
}

export interface ModCardProps {
  id?: string;
  title: string;
  author: string;
  downloads: string;
  updated: string;
  summary: string;
  icon?: string;
  categories?: string[];
  isInstalled?: boolean;
  provider?: "modrinth" | "curseforge" | "custom";
}

// ==========================================
// 3. Modpack Schema (V1.0 Standard Proposal)
// ==========================================

export interface ModpackFileHashes {
  sha1?: string;
  sha256?: string;
  sha512?: string;
  md5?: string;
}

export interface ModpackEnvironment {
  client?: "required" | "optional" | "unsupported";
  server?: "required" | "optional" | "unsupported";
}

export interface ModpackFileEntry {
  path: string;
  hashes: ModpackFileHashes;
  downloads: string[];
  fileSize?: number;
  env?: ModpackEnvironment;
}

export interface ModpackManifest {
  formatVersion: 1;
  id: string;
  name: string;
  version: string;
  game: "minecraft";
  gameVersion: string;
  loader: {
    id: string;
    version?: string;
  };
  summary?: string;
  author?: string;
  files: ModpackFileEntry[];
  overridesPath?: string;
}
