import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PackSettings, Loader, MojangVersion, ModrinthLoaderTag, PackContextType, InstalledItem, CustomFileItem, PackReleaseData } from "@/types";
import { 
  getPackagesIndex, 
  savePackagesIndex, 
  getPackData, 
  getPackDataAsync,
  savePackData, 
  deletePackStorage,
  PackExclusiveData 
} from "@/lib/storage/package-storage";
import { detectFileType } from "@/lib/storage/config-files-storage";
import { checkItemCompatibility } from "@/lib/api/verify-compatibility";

const PackContext = createContext<PackContextType | null>(null);

const DEFAULT_RELEASE_VERSIONS = [
  "26.3",
  "1.20.2",
  "1.20.1",
  "1.20",
  "1.19.4",
  "1.19.2",
  "1.18.2",
  "1.16.5",
  "1.12.2"
];

const DEFAULT_LOADERS: Loader[] = [
  { id: "fabric", name: "Fabric" },
  { id: "forge", name: "Forge" },
  { id: "neoforge", name: "NeoForge" },
  { id: "quilt", name: "Quilt" }
];

export const generateRandomPackId = (): string => {
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `modpkg-${randomStr}`;
};

export const resolveSafePackId = (rawId: string, existingList: PackSettings[], excludePackId?: string): string => {
  let cleanId = (rawId || "modpkg")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");

  if (!cleanId) {
    cleanId = "modpkg";
  }

  const existingIds = new Set(
    existingList
      .filter(p => !excludePackId || p.id.toLowerCase() !== excludePackId.toLowerCase())
      .map(p => p.id.toLowerCase())
  );
  
  if (!existingIds.has(cleanId)) {
    return cleanId;
  }

  // If ID ends in -N, extract base prefix and start counting from N + 1
  const baseMatch = cleanId.match(/^(.*?)-(\d+)$/);
  const basePrefix = baseMatch ? baseMatch[1] : cleanId;
  let counter = baseMatch ? parseInt(baseMatch[2], 10) + 1 : 2;

  while (existingIds.has(`${basePrefix}-${counter}`)) {
    counter++;
  }
  return `${basePrefix}-${counter}`;
};

export const resolveSafeImportId = resolveSafePackId;

const DEFAULT_FALLBACK_PACK: PackSettings = {
  id: "modpkg-default",
  name: "MODPKG",
  slug: "modpkg-default",
  mcVersion: "26.3",
  loader: "fabric",
  versions: ["v1.0.0"],
  currentVersion: "v1.0.0",
  description: "Mi modpack personalizado creado con MODPKG"
};

export function PackProvider({ children }: { children: ReactNode }) {
  const [packagesList, setPackagesList] = useState<PackSettings[]>(() => getPackagesIndex());
  const [activePackId, setActivePackId] = useState<string | null>(() => {
    const list = getPackagesIndex();
    return list.length > 0 ? list[0].id : null;
  });

  const [packSettings, setPackSettings] = useState<PackSettings>(() => {
    const list = getPackagesIndex();
    return list.length > 0 ? list[0] : DEFAULT_FALLBACK_PACK;
  });

  const [installedContent, setInstalledContent] = useState<InstalledItem[]>([]);
  const [customFiles, setCustomFiles] = useState<CustomFileItem[]>([]);
  const [verifiedItems, setVerifiedItemsState] = useState<string[]>([]);

  const setVerifiedItems = (items: string[] | ((prev: string[]) => string[])) => {
    setVerifiedItemsState(prev => {
      const next = typeof items === "function" ? items(prev) : items;
      if (activePackId) {
        const data = getPackData(activePackId);
        const curVer = packSettings.currentVersion || "v1.0.0";
        if (data.releases && data.releases[curVer]) {
          data.releases[curVer].verifiedItems = next;
        }
        data.verifiedItems = next;
        savePackData(activePackId, data);
      }
      return next;
    });
  };

  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [rawMcVersions, setRawMcVersions] = useState<MojangVersion[]>([]);
  const [rawLoaders, setRawLoaders] = useState<ModrinthLoaderTag[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(true);
  const [latestMcRelease, setLatestMcRelease] = useState<string>("26.3");
  const [isCreatePackModalOpen, setIsCreatePackModalOpen] = useState<boolean>(false);

  // Load active pack data when activePackId changes
  useEffect(() => {
    let isMounted = true;
    if (!activePackId) {
      if (packagesList.length === 0) {
        setIsCreatePackModalOpen(true);
      }
      return;
    }
    const current = packagesList.find(p => p.id === activePackId) || getPackagesIndex().find(p => p.id === activePackId);
    if (current) {
      setPackSettings(prev => {
        if (
          prev.id === current.id && 
          prev.mcVersion === current.mcVersion && 
          prev.loader === current.loader && 
          prev.currentVersion === current.currentVersion && 
          prev.name === current.name
        ) {
          return prev;
        }
        return current;
      });
      const curVer = current.currentVersion || "v1.0.0";

      // Immediate synchronous load from memory / localStorage
      const syncData = getPackData(current.id);
      if (syncData.releases && syncData.releases[curVer]) {
        setInstalledContent(syncData.releases[curVer].installedContent || []);
        setCustomFiles(syncData.releases[curVer].customFiles || []);
        setVerifiedItems(syncData.releases[curVer].verifiedItems || []);
      } else {
        setInstalledContent(syncData.installedContent || []);
        setCustomFiles(syncData.customFiles || []);
        setVerifiedItems(syncData.verifiedItems || []);
      }

      // Asynchronous hydration from IndexedDB (full persistent data without quota limit)
      getPackDataAsync(current.id).then((data) => {
        if (!isMounted) return;
        if (!data.releases) {
          data.releases = {};
        }

        if (!data.releases[curVer]) {
          data.releases[curVer] = {
            releaseId: curVer,
            minecraft: current.mcVersion,
            loader: {
              type: current.loader,
              version: current.loaderVersion || "latest",
            },
            installedContent: data.installedContent || [],
            customFiles: data.customFiles || [],
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            verifiedItems: data.verifiedItems || [],
          };
        }

        // Ensure all versions in current.versions exist in releases
        (current.versions || [curVer]).forEach(v => {
          if (!data.releases![v]) {
            data.releases![v] = {
              releaseId: v,
              minecraft: current.mcVersion,
              loader: { type: current.loader, version: current.loaderVersion || "latest" },
              installedContent: v === curVer ? [...(data.installedContent || [])] : [],
              customFiles: v === curVer ? [...(data.customFiles || [])] : [],
              publishedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              verifiedItems: v === curVer ? [...(data.verifiedItems || [])] : [],
            };
          }
        });

        const activeRelease = data.releases[curVer];
        setInstalledContent(activeRelease.installedContent || []);
        setCustomFiles(activeRelease.customFiles || []);
        setVerifiedItems(activeRelease.verifiedItems || []);
      }).catch(err => {
        console.warn("Failed to load pack data from IndexedDB:", err);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [activePackId, packagesList]);

  // Fetch real Minecraft versions from Mojang API & Modrinth loaders
  useEffect(() => {
    async function fetchMojangVersions() {
      try {
        const res = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
        if (res.ok) {
          const data = await res.json();
          const versionsList: MojangVersion[] = data.versions || [];
          setRawMcVersions(versionsList);
          
          const latestRelease = data.latest?.release || versionsList.find(v => v.type === "release")?.id;
          if (latestRelease) {
            setLatestMcRelease(latestRelease);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch Mojang version manifest, using defaults:", err);
      } finally {
        setIsLoadingVersions(false);
      }
    }

    async function fetchModrinthLoaders() {
      try {
        const res = await fetch("https://api.modrinth.com/v2/tag/loader");
        if (res.ok) {
          const data = await res.json();
          setRawLoaders(data || []);
        }
      } catch (err) {
        console.warn("Failed to fetch Modrinth loaders, using defaults:", err);
      }
    }

    fetchMojangVersions();
    fetchModrinthLoaders();
  }, []);

  const getMinecraftVersions = (showAll = false): string[] => {
    if (rawMcVersions.length === 0) {
      return DEFAULT_RELEASE_VERSIONS;
    }
    if (showAll) {
      return rawMcVersions.map(v => v.id);
    }
    return rawMcVersions
      .filter(v => v.type === "release")
      .map(v => v.id);
  };

  const getLoaders = (showAll = false): Loader[] => {
    if (rawLoaders.length === 0) {
      return DEFAULT_LOADERS;
    }
    if (showAll) {
      return rawLoaders.map(l => ({
        id: l.name,
        name: l.name.charAt(0).toUpperCase() + l.name.slice(1)
      }));
    }
    const mainLoaders = ["fabric", "forge", "neoforge", "quilt"];
    return DEFAULT_LOADERS.filter(l => mainLoaders.includes(l.id));
  };

  // Create new package
  const createPack = (packData: Omit<PackSettings, "id" | "versions" | "currentVersion"> & { id?: string; version?: string }): PackSettings => {
    const rawId = packData.id || generateRandomPackId();
    const newId = resolveSafePackId(rawId, packagesList);
    const newVersion = packData.version || "v1.0.0";
    const newPack: PackSettings = {
      id: newId,
      name: packData.name || "MODPKG",
      slug: newId,
      mcVersion: packData.mcVersion || latestMcRelease,
      loader: packData.loader || "fabric",
      versions: [newVersion],
      currentVersion: newVersion,
      description: packData.description || "Mi modpack personalizado creado con MODPKG",
    };

    const updatedList = [newPack, ...packagesList];
    setPackagesList(updatedList);
    savePackagesIndex(updatedList);

    // Initialize per-pack storage object
    const initialRelease = {
      releaseId: newVersion,
      minecraft: newPack.mcVersion,
      loader: {
        type: newPack.loader,
        version: newPack.loaderVersion || "latest",
      },
      installedContent: [],
      customFiles: [],
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const emptyData: PackExclusiveData = {
      id: newId,
      installedContent: [],
      customContent: [],
      customFiles: [],
      releases: {
        [newVersion]: initialRelease,
      },
    };
    savePackData(newId, emptyData);

    setActivePackId(newId);
    setPackSettings(newPack);
    setInstalledContent([]);
    setCustomFiles([]);
    setVerifiedItems([]);
    setIsCreatePackModalOpen(false);

    return newPack;
  };

  // Import package from file (.mpkg, .mpkg-proj, or legacy .json)
  const importPack = (parsedJson: any): PackSettings => {
    // 0. Verify JSON structure to prevent errors
    if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
      throw new Error("Invalid JSON: The file must contain a valid JSON object.");
    }

    const hasRecognizedStructure = Boolean(
      parsedJson.project ||
      parsedJson.releases ||
      parsedJson.metadata ||
      parsedJson.dependencies ||
      parsedJson.content ||
      parsedJson.mods ||
      parsedJson.minecraftVersion ||
      parsedJson.installedContent ||
      parsedJson.files ||
      parsedJson.overrides ||
      parsedJson.customFiles
    );

    if (!hasRecognizedStructure) {
      throw new Error("The JSON structure is not recognized. It does not contain MODPKG metadata, releases, or mods.");
    }

    const currentList = getPackagesIndex();

    // Check if full project export (.mpkg-proj.json format or has project + releases)
    const isFullProject = Boolean(
      parsedJson.project && (parsedJson.releases || parsedJson.project.versions || parsedJson.project.releases)
    );

    if (isFullProject) {
      const proj = parsedJson.project || {};
      const rawId = proj.id || parsedJson.id || "imported-project";
      const targetId = resolveSafeImportId(rawId, currentList);
      const packName = proj.name || parsedJson.name || "Imported Project";
      const description = proj.description || parsedJson.description || "";

      const rawReleases = parsedJson.releases || proj.releases || {};
      const releaseKeys = Object.keys(rawReleases);
      const rawVersions = Array.isArray(proj.versions) && proj.versions.length > 0
        ? proj.versions
        : releaseKeys;
      const allVersionSet = new Set([...rawVersions, ...releaseKeys]);
      const versions = allVersionSet.size > 0 ? Array.from(allVersionSet) : ["v1.0.0"];
      const currentVersion = proj.currentVersion && versions.includes(proj.currentVersion)
        ? proj.currentVersion
        : versions[0];

      const finalReleases: Record<string, PackReleaseData> = {};

      versions.forEach((ver: string) => {
        const r = rawReleases[ver] || {};
        finalReleases[ver] = {
          releaseId: ver,
          minecraft: r.minecraft || proj.mcVersion || "26.3",
          loader: {
            type: r.loader?.type || proj.loader || "fabric",
            version: r.loader?.version || proj.loaderVersion || "latest",
          },
          installedContent: Array.isArray(r.installedContent) ? r.installedContent : [],
          customFiles: Array.isArray(r.customFiles) ? r.customFiles : [],
          publishedAt: r.publishedAt || new Date().toISOString(),
          updatedAt: r.updatedAt || new Date().toISOString(),
        };
      });

      const activeRelease = finalReleases[currentVersion] || Object.values(finalReleases)[0];
      const activeInstalledContent = activeRelease ? activeRelease.installedContent : [];
      const activeCustomFiles = activeRelease ? activeRelease.customFiles : [];

      const newPack: PackSettings = {
        id: targetId,
        name: packName,
        slug: proj.slug || targetId,
        mcVersion: proj.mcVersion || activeRelease?.minecraft || "26.3",
        loader: proj.loader || activeRelease?.loader?.type || "fabric",
        loaderVersion: proj.loaderVersion || activeRelease?.loader?.version || "latest",
        versions,
        currentVersion,
        description,
        author: proj.author || "Zmito",
        authorId: proj.authorId || "usuario-redsouth-uuid",
        isPublic: proj.isPublic ?? true,
        tags: proj.tags || [],
        createdAt: proj.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const packData: PackExclusiveData = {
        id: targetId,
        installedContent: activeInstalledContent,
        customContent: [],
        customFiles: activeCustomFiles,
        releases: finalReleases,
      };

      // 1. Save data directly to localStorage
      savePackData(targetId, packData);

      // 2. Save packages index
      const updatedList = [newPack, ...currentList.filter(p => p.id !== targetId)];
      savePackagesIndex(updatedList);

      // 3. Update React states
      setPackagesList(updatedList);
      setActivePackId(targetId);
      setPackSettings(newPack);
      setInstalledContent(activeInstalledContent);
      setCustomFiles(activeCustomFiles);
      setIsCreatePackModalOpen(false);

      return newPack;
    }

    // Check if legacy MODPKG format: contains minecraftVersion or mods without modern metadata/project wrappers
    const isLegacyFormat = Boolean(
      (parsedJson.minecraftVersion || (parsedJson.mods && !parsedJson.content)) &&
      !parsedJson.metadata &&
      !parsedJson.project &&
      !parsedJson.formatVersion
    );

    // Single version / release format (.modpkg.json / .mdpkg.json / .mpkg.json / manifest / legacy JSON)
    const metadata = parsedJson.metadata || {};
    const dependencies = parsedJson.dependencies || {};

    const packName = isLegacyFormat
      ? (parsedJson.name || "MODPKG")
      : (metadata.name || parsedJson.name || "Imported Modpack");

    const randomLegacySuffix = Math.random().toString(36).substring(2, 8);
    const rawId = isLegacyFormat
      ? `modpkg-legacy-${randomLegacySuffix}`
      : (metadata.projectId || parsedJson.id || packName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "") || "modpkg");
    const targetId = resolveSafeImportId(rawId, currentList);

    const versionId = isLegacyFormat
      ? "v1.0.0"
      : (metadata.versionId || parsedJson.currentVersion || parsedJson.version || "v1.0.0");

    const description = isLegacyFormat
      ? (parsedJson.description || "Legacy MODPKG package")
      : (metadata.description || parsedJson.description || "Imported package");

    const mcVersion = parsedJson.minecraftVersion || dependencies.minecraft || parsedJson.mcVersion || parsedJson.gameVersion || "26.3";
    const loader = (typeof dependencies.loader === "object" ? dependencies.loader.type : dependencies.loader)
      || (typeof parsedJson.loader === "object" ? parsedJson.loader.id || parsedJson.loader.type : parsedJson.loader)
      || "fabric";
    const loaderVersion = (typeof dependencies.loader === "object" ? dependencies.loader.version : undefined)
      || (typeof parsedJson.loader === "object" ? parsedJson.loader.version : undefined)
      || "latest";

    // 1. Extract installed content
    const parsedInstalledContent: InstalledItem[] = [];
    const contentRoot = parsedJson.content || parsedJson.mods;

    if (contentRoot && typeof contentRoot === "object") {
      if (Array.isArray(contentRoot.modrinth)) {
        contentRoot.modrinth.forEach((m: any) => {
          if (m && (m.id || m.projectId || m.slug)) {
            const id = String(m.id || m.projectId || m.slug);
            parsedInstalledContent.push({
              id,
              name: m.name || id,
              provider: "modrinth",
              iconUrl: m.iconUrl || m.icon || "",
              versionId: m.versionId || "latest",
              versionName: m.versionName || m.versionId || "Latest",
              contentType: m.type || m.contentType || "mod",
              downloadUrl: m.url || m.downloadUrl,
            });
          }
        });
      }
      if (Array.isArray(contentRoot.curseforge)) {
        contentRoot.curseforge.forEach((m: any) => {
          if (m && (m.id || m.projectId || m.fileId)) {
            const id = String(m.id || m.projectId || m.fileId);
            parsedInstalledContent.push({
              id,
              name: m.name || id,
              provider: "curseforge",
              iconUrl: m.iconUrl || m.icon || "",
              versionId: String(m.fileId || m.versionId || "latest"),
              versionName: m.fileName || m.versionName || "Latest",
              contentType: m.type || m.contentType || "mod",
              downloadUrl: m.url || m.downloadUrl,
            });
          }
        });
      }
      const customItems = contentRoot.custom || contentRoot.directUrls;
      if (Array.isArray(customItems)) {
        customItems.forEach((m: any) => {
          if (m && (m.url || m.downloadUrl || m.name || m.id)) {
            parsedInstalledContent.push({
              id: m.id || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: m.name || m.fileName || "Custom Resource",
              provider: "custom",
              iconUrl: m.iconUrl || m.icon || "",
              versionId: "custom",
              versionName: "Custom URL",
              contentType: m.type || m.contentType || "mod",
              downloadUrl: m.url || m.downloadUrl,
              targetPath: m.targetPath,
            });
          }
        });
      }
    }

    if (parsedInstalledContent.length === 0 && Array.isArray(parsedJson.installedContent)) {
      parsedJson.installedContent.forEach((item: any) => {
        if (item && item.id) parsedInstalledContent.push(item);
      });
    } else if (parsedInstalledContent.length === 0 && Array.isArray(parsedJson.files)) {
      // CurseForge manifest or modpack manifest format
      parsedJson.files.forEach((f: any) => {
        if (f.projectID || f.fileId || f.id) {
          parsedInstalledContent.push({
            id: String(f.projectID || f.fileId || f.id),
            name: f.name || `Project ${f.projectID || f.fileId || f.id}`,
            provider: "curseforge",
            iconUrl: "",
            versionId: String(f.fileID || f.versionId || "latest"),
            versionName: "Latest",
            contentType: "mod",
          });
        }
      });
    }

    // 2. Extract overrides / custom files
    const parsedCustomFiles: CustomFileItem[] = [];
    if (Array.isArray(parsedJson.overrides)) {
      parsedJson.overrides.forEach((o: any) => {
        const rawPath = o.path || o.targetPath;
        if (rawPath) {
          const cleanPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
          const filename = o.name || cleanPath.split("/").pop() || "options.txt";
          parsedCustomFiles.push({
            id: o.id || `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: filename,
            targetPath: cleanPath,
            type: o.fileType || detectFileType(filename) || "config",
            content: o.type === "text" || !o.type ? (o.content ?? "") : undefined,
            sourceUrl: o.type === "url" || o.url ? (o.url || o.sourceUrl) : undefined,
            storageLocation: "local_browser",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      });
    }
    
    if (parsedCustomFiles.length === 0 && Array.isArray(parsedJson.customFiles)) {
      parsedJson.customFiles.forEach((file: any) => {
        if (file && (file.id || file.name)) parsedCustomFiles.push(file);
      });
    }

    // Single-release project (only this version)
    const singleRelease: PackReleaseData = {
      releaseId: versionId,
      minecraft: mcVersion,
      loader: {
        type: loader,
        version: loaderVersion,
      },
      installedContent: parsedInstalledContent,
      customFiles: parsedCustomFiles,
      publishedAt: parsedJson.exportedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newPack: PackSettings = {
      id: targetId,
      name: packName,
      slug: targetId,
      mcVersion,
      loader,
      loaderVersion,
      versions: [versionId], // ONLY this version
      currentVersion: versionId,
      description,
      author: metadata.author || "Zmito",
      authorId: metadata.authorId || "usuario-redsouth-uuid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const packData: PackExclusiveData = {
      id: targetId,
      installedContent: parsedInstalledContent,
      customContent: [],
      customFiles: parsedCustomFiles,
      releases: {
        [versionId]: singleRelease,
      },
    };

    // 1. Save data directly to localStorage
    savePackData(targetId, packData);

    // 2. Save packages index
    const updatedList = [newPack, ...currentList.filter(p => p.id !== targetId)];
    savePackagesIndex(updatedList);

    // 3. Update React states
    setPackagesList(updatedList);
    setActivePackId(targetId);
    setPackSettings(newPack);
    setInstalledContent(parsedInstalledContent);
    setCustomFiles(parsedCustomFiles);
    setIsCreatePackModalOpen(false);

    return newPack;
  };

  // Switch active pack
  const switchPack = (packId: string) => {
    // If clicking the currently active pack, ensure memory state is flushed to storage and do not reset
    if (activePackId === packId) {
      if (activePackId) {
        const curData = getPackData(activePackId);
        if (!curData.releases) curData.releases = {};
        const curVer = packSettings.currentVersion || "v1.0.0";
        curData.releases[curVer] = {
          ...(curData.releases[curVer] || {
            releaseId: curVer,
            minecraft: packSettings.mcVersion,
            loader: { type: packSettings.loader, version: packSettings.loaderVersion || "latest" },
          }),
          installedContent: installedContent,
          customFiles: customFiles,
          verifiedItems: verifiedItems,
          updatedAt: new Date().toISOString(),
        };
        curData.installedContent = installedContent;
        curData.customFiles = customFiles;
        curData.verifiedItems = verifiedItems;
        savePackData(activePackId, curData);
      }
      return;
    }

    // Save previous active pack's release data before switching away (only if it still exists and wasn't deleted)
    if (activePackId && packagesList.some(p => p.id === activePackId)) {
      const prevData = getPackData(activePackId);
      if (!prevData.releases) prevData.releases = {};
      const prevVer = packSettings.currentVersion || "v1.0.0";
      prevData.releases[prevVer] = {
        ...(prevData.releases[prevVer] || {
          releaseId: prevVer,
          minecraft: packSettings.mcVersion,
          loader: { type: packSettings.loader, version: packSettings.loaderVersion || "latest" },
        }),
        installedContent: installedContent,
        customFiles: customFiles,
        verifiedItems: verifiedItems,
        updatedAt: new Date().toISOString(),
      };
      prevData.installedContent = installedContent;
      prevData.customFiles = customFiles;
      prevData.verifiedItems = verifiedItems;
      savePackData(activePackId, prevData);
    }

    const target = packagesList.find(p => p.id === packId);
    if (!target) return;
    setActivePackId(packId);
    setPackSettings(target);
    const data = getPackData(packId);
    const curVer = target.currentVersion || "v1.0.0";
    if (!data.releases) data.releases = {};
    if (!data.releases[curVer]) {
      data.releases[curVer] = {
        releaseId: curVer,
        minecraft: target.mcVersion,
        loader: { type: target.loader, version: target.loaderVersion || "latest" },
        installedContent: data.installedContent || [],
        customFiles: data.customFiles || [],
        verifiedItems: data.verifiedItems || [],
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      savePackData(packId, data);
    }
    const activeRel = data.releases[curVer];
    setInstalledContent(activeRel.installedContent || []);
    setCustomFiles(activeRel.customFiles || []);
    setVerifiedItems(activeRel.verifiedItems || []);
  };

  // Delete package
  const deletePack = (packId: string) => {
    const updatedList = packagesList.filter(p => p.id !== packId);
    setPackagesList(updatedList);
    savePackagesIndex(updatedList);
    deletePackStorage(packId);

    // Only switch or reset if the deleted pack was the currently active one
    if (activePackId === packId) {
      if (updatedList.length > 0) {
        const nextPack = updatedList[0];
        setActivePackId(nextPack.id);
        setPackSettings(nextPack);
        const data = getPackData(nextPack.id);
        const curVer = nextPack.currentVersion || "v1.0.0";
        if (!data.releases) data.releases = {};
        if (!data.releases[curVer]) {
          data.releases[curVer] = {
            releaseId: curVer,
            minecraft: nextPack.mcVersion,
            loader: { type: nextPack.loader, version: nextPack.loaderVersion || "latest" },
            installedContent: data.installedContent || [],
            customFiles: data.customFiles || [],
            verifiedItems: data.verifiedItems || [],
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          savePackData(nextPack.id, data);
        }
        const activeRel = data.releases[curVer];
        setInstalledContent(activeRel.installedContent || []);
        setCustomFiles(activeRel.customFiles || []);
        setVerifiedItems(activeRel.verifiedItems || []);
      } else {
        setActivePackId(null);
        setPackSettings(DEFAULT_FALLBACK_PACK);
        setInstalledContent([]);
        setCustomFiles([]);
        setVerifiedItems([]);
        setIsCreatePackModalOpen(true);
      }
    }
  };

  const updatePackSettings = (newSettings: Partial<PackSettings>, targetPackId?: string) => {
    const targetId = targetPackId || activePackId || packSettings.id;
    const isTargetActive = targetId === activePackId;

    const targetPack = packagesList.find(p => p.id === targetId) || (isTargetActive ? packSettings : null);
    if (!targetPack) return;

    const prevId = targetPack.id;
    const requestedRawId = (newSettings.id || prevId).trim();
    // Resolve safe ID excluding the current pack being edited
    const requestedNewId = resolveSafePackId(requestedRawId, packagesList, prevId);
    const isChangingId = Boolean(requestedNewId && requestedNewId !== prevId);

    const prevVersion = targetPack.currentVersion;
    const newVersion = newSettings.currentVersion ?? prevVersion;
    const isSwitchingVersion = newVersion !== prevVersion;

    const packData = getPackData(prevId);
    if (!packData.releases) packData.releases = {};

    // 1. Save current active version state if it's the active pack
    if (isTargetActive) {
      packData.releases[prevVersion] = {
        ...(packData.releases[prevVersion] || {
          releaseId: prevVersion,
          minecraft: targetPack.mcVersion,
          loader: { type: targetPack.loader, version: targetPack.loaderVersion || "latest" },
        }),
        installedContent: installedContent,
        customFiles: customFiles,
        verifiedItems: verifiedItems,
        updatedAt: new Date().toISOString(),
      };
    }

    // 2. If switching to new version, load its contents (only into memory if active)
    if (isSwitchingVersion) {
      const targetRelease = packData.releases[newVersion] || {
        releaseId: newVersion,
        minecraft: newSettings.mcVersion || targetPack.mcVersion,
        loader: {
          type: newSettings.loader || targetPack.loader,
          version: targetPack.loaderVersion || "latest",
        },
        installedContent: [],
        customFiles: [],
        verifiedItems: [],
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (newSettings.mcVersion) targetRelease.minecraft = newSettings.mcVersion;
      if (newSettings.loader) {
        if (!targetRelease.loader) targetRelease.loader = { type: newSettings.loader, version: targetPack.loaderVersion || "latest" };
        else targetRelease.loader.type = newSettings.loader;
      }
      packData.releases[newVersion] = targetRelease;
      packData.installedContent = targetRelease.installedContent || [];
      packData.customFiles = targetRelease.customFiles || [];
      packData.verifiedItems = targetRelease.verifiedItems || [];

      if (isTargetActive) {
        setInstalledContent(targetRelease.installedContent || []);
        setCustomFiles(targetRelease.customFiles || []);
        setVerifiedItems(targetRelease.verifiedItems || []);
      }
    } else {
      if (!packData.releases[prevVersion]) {
        packData.releases[prevVersion] = {
          releaseId: prevVersion,
          minecraft: targetPack.mcVersion,
          loader: { type: targetPack.loader, version: targetPack.loaderVersion || "latest" },
          installedContent: installedContent,
          customFiles: customFiles,
          verifiedItems: verifiedItems,
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      const mcChanged = Boolean(newSettings.mcVersion && newSettings.mcVersion !== targetPack.mcVersion);
      const loaderChanged = Boolean(newSettings.loader && newSettings.loader !== targetPack.loader);
      if (mcChanged || loaderChanged) {
        // Reset verifications for this version
        packData.releases[prevVersion].verifiedItems = [];
        packData.verifiedItems = [];
        if (isTargetActive) {
          setVerifiedItems([]);
        }
      }
      if (newSettings.mcVersion) packData.releases[prevVersion].minecraft = newSettings.mcVersion;
      if (newSettings.loader) {
        packData.releases[prevVersion].loader = {
          type: newSettings.loader,
          version: targetPack.loaderVersion || "latest",
        };
      }
      packData.installedContent = packData.releases[prevVersion].installedContent || installedContent;
      packData.customFiles = packData.releases[prevVersion].customFiles || customFiles;
    }

    // 3. If ID is changing, migrate storage to the new ID
    const finalId = isChangingId ? requestedNewId : prevId;
    if (isChangingId) {
      if (isTargetActive) {
        packData.installedContent = installedContent;
        packData.customFiles = customFiles;
        if (packData.releases && packData.releases[prevVersion]) {
          packData.releases[prevVersion].installedContent = installedContent;
          packData.releases[prevVersion].customFiles = customFiles;
        }
      }
      packData.id = finalId;
      savePackData(finalId, packData);
      deletePackStorage(prevId);

      // In the background, ensure full IDB data is migrated to finalId
      getPackDataAsync(prevId).then((fullIdbData) => {
        if (fullIdbData && fullIdbData.customFiles && fullIdbData.customFiles.length > packData.customFiles.length) {
          fullIdbData.id = finalId;
          savePackData(finalId, fullIdbData);
        }
      }).catch(err => console.warn("Background IDB migration check failed:", err));

      // Also migrate hidden custom items if present
      try {
        const oldHiddenKey = `modpkg_hidden_custom_${prevId}`;
        const newHiddenKey = `modpkg_hidden_custom_${finalId}`;
        const hiddenData = localStorage.getItem(oldHiddenKey);
        if (hiddenData) {
          localStorage.setItem(newHiddenKey, hiddenData);
          localStorage.removeItem(oldHiddenKey);
        }
      } catch {
        // Ignore localStorage errors
      }

      if (isTargetActive) {
        setActivePackId(finalId);
      }
    } else {
      savePackData(prevId, packData);
    }

    // Guarantee slug is always identical to id
    const updated: PackSettings = { 
      ...targetPack, 
      ...newSettings, 
      id: finalId, 
      slug: finalId 
    };

    const updatedList = packagesList.map(p => p.id === prevId ? updated : p);
    setPackagesList(updatedList);
    savePackagesIndex(updatedList);

    if (isTargetActive) {
      setPackSettings(updated);
    }
    return updated;
  };

  const createNewVersion = (versionName: string, copyFromVersion = "empty", targetPackId?: string) => {
    const trimmed = versionName.trim();
    if (!trimmed) return;

    const targetId = targetPackId || activePackId || packSettings.id;
    const isTargetActive = targetId === activePackId;
    const targetPack = packagesList.find(p => p.id === targetId) || (isTargetActive ? packSettings : null);
    if (!targetPack) return;

    let newContent: InstalledItem[] = [];
    let newFiles: CustomFileItem[] = [];

    const packData = getPackData(targetId);
    if (!packData.releases) packData.releases = {};

    // 1. Save current active version first if active
    const currentVer = targetPack.currentVersion;
    if (isTargetActive) {
      packData.releases[currentVer] = {
        ...(packData.releases[currentVer] || {
          releaseId: currentVer,
          minecraft: targetPack.mcVersion,
          loader: { type: targetPack.loader, version: targetPack.loaderVersion || "latest" },
        }),
        installedContent: installedContent,
        customFiles: customFiles,
        updatedAt: new Date().toISOString(),
      };
    }

    // 2. Resolve content for new version based on copyFromVersion
    if (copyFromVersion && copyFromVersion !== "empty") {
      if (isTargetActive && copyFromVersion === currentVer) {
        newContent = JSON.parse(JSON.stringify(installedContent || []));
        newFiles = JSON.parse(JSON.stringify(customFiles || []));
      } else if (packData.releases[copyFromVersion]) {
        newContent = JSON.parse(JSON.stringify(packData.releases[copyFromVersion].installedContent || []));
        newFiles = JSON.parse(JSON.stringify(packData.releases[copyFromVersion].customFiles || []));
      }
    }

    // 3. Create and save release for new version
    packData.releases[trimmed] = {
      releaseId: trimmed,
      minecraft: targetPack.mcVersion,
      loader: {
        type: targetPack.loader,
        version: targetPack.loaderVersion || "latest",
      },
      installedContent: newContent,
      customFiles: newFiles,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    packData.installedContent = newContent;
    packData.customFiles = newFiles;

    savePackData(targetId, packData);

    // 4. Update memory states if active
    if (isTargetActive) {
      setInstalledContent(newContent);
      setCustomFiles(newFiles);
    }

    const exists = targetPack.versions.includes(trimmed);
    const updatedVersions = exists ? targetPack.versions : [...targetPack.versions, trimmed];

    const updated: PackSettings = {
      ...targetPack,
      versions: updatedVersions,
      currentVersion: trimmed,
    };

    const updatedList = packagesList.map(p => p.id === targetPack.id ? updated : p);
    setPackagesList(updatedList);
    savePackagesIndex(updatedList);

    if (isTargetActive) {
      setPackSettings(updated);
    }
  };

  const deleteVersion = (versionToDelete: string, targetPackId?: string) => {
    const targetId = targetPackId || activePackId || packSettings.id;
    const isTargetActive = targetId === activePackId;
    const targetPack = packagesList.find(p => p.id === targetId) || (isTargetActive ? packSettings : null);
    if (!targetPack || targetPack.versions.length <= 1) return;

    const filteredVersions = targetPack.versions.filter(v => v !== versionToDelete);
    const nextCurrentVersion = targetPack.currentVersion === versionToDelete 
      ? filteredVersions[0] 
      : targetPack.currentVersion;

    const packData = getPackData(targetId);
    if (packData.releases && packData.releases[versionToDelete]) {
      delete packData.releases[versionToDelete];
    }

    if (targetPack.currentVersion === versionToDelete) {
      const nextRelease = packData.releases?.[nextCurrentVersion];
      const nextContent = nextRelease?.installedContent || [];
      const nextFiles = nextRelease?.customFiles || [];
      packData.installedContent = nextContent;
      packData.customFiles = nextFiles;
      if (isTargetActive) {
        setInstalledContent(nextContent);
        setCustomFiles(nextFiles);
      }
    }
    savePackData(targetId, packData);

    const updated: PackSettings = {
      ...targetPack,
      versions: filteredVersions,
      currentVersion: nextCurrentVersion,
    };

    const updatedList = packagesList.map(p => p.id === targetPack.id ? updated : p);
    setPackagesList(updatedList);
    savePackagesIndex(updatedList);

    if (isTargetActive) {
      setPackSettings(updated);
    }
  };

  const addContent = (item: InstalledItem) => {
    setInstalledContent(prev => {
      const updated = prev.some(i => i.id === item.id)
        ? prev.map(i => i.id === item.id ? { ...i, ...item } : i)
        : [...prev, item];
      
      if (activePackId) {
        const packData = getPackData(activePackId);
        packData.installedContent = updated;
        const curVer = packSettings.currentVersion || "v1.0.0";
        if (!packData.releases) packData.releases = {};
        if (!packData.releases[curVer]) {
          packData.releases[curVer] = {
            releaseId: curVer,
            minecraft: packSettings.mcVersion,
            loader: { type: packSettings.loader, version: packSettings.loaderVersion || "latest" },
            installedContent: updated,
            customFiles: customFiles,
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        } else {
          packData.releases[curVer].installedContent = updated;
          packData.releases[curVer].updatedAt = new Date().toISOString();
        }
        savePackData(activePackId, packData);
      }
      return updated;
    });
  };

  const removeContent = (id: string) => {
    setInstalledContent(prev => {
      const updated = prev.filter(i => i.id !== id);
      if (activePackId) {
        const packData = getPackData(activePackId);
        packData.installedContent = updated;
        const curVer = packSettings.currentVersion || "v1.0.0";
        if (!packData.releases) packData.releases = {};
        if (packData.releases[curVer]) {
          packData.releases[curVer].installedContent = updated;
          packData.releases[curVer].verifiedItems = (packData.releases[curVer].verifiedItems || []).filter(vId => vId !== id);
          packData.releases[curVer].updatedAt = new Date().toISOString();
        }
        packData.verifiedItems = (packData.verifiedItems || []).filter(vId => vId !== id);
        savePackData(activePackId, packData);
      }
      return updated;
    });
    setVerifiedItems(prev => prev.filter(vId => vId !== id));
  };

  const verifyPackContents = async (): Promise<{ verifiedCount: number; totalCount: number; failedNames: string[] }> => {
    if (installedContent.length === 0) {
      return { verifiedCount: 0, totalCount: 0, failedNames: [] };
    }

    setIsVerifying(true);
    const newlyVerifiedIds: string[] = [];
    const failedNames: string[] = [];

    try {
      const results = await Promise.allSettled(
        installedContent.map(async (item) => {
          const res = await checkItemCompatibility(item, packSettings.mcVersion, packSettings.loader);
          return { item, ...res };
        })
      );

      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value.isCompatible) {
          newlyVerifiedIds.push(r.value.item.id);
        } else if (r.status === "fulfilled" && !r.value.isCompatible) {
          failedNames.push(r.value.item.name);
        }
      });

      setVerifiedItems(newlyVerifiedIds);

      if (activePackId) {
        const data = getPackData(activePackId);
        const curVer = packSettings.currentVersion || "v1.0.0";
        if (data.releases && data.releases[curVer]) {
          data.releases[curVer].verifiedItems = newlyVerifiedIds;
        }
        data.verifiedItems = newlyVerifiedIds;
        savePackData(activePackId, data);
      }

      return {
        verifiedCount: newlyVerifiedIds.length,
        totalCount: installedContent.length,
        failedNames,
      };
    } finally {
      setIsVerifying(false);
    }
  };

  const addCustomFile = (file: CustomFileItem) => {
    setCustomFiles(prev => {
      const updated = [file, ...prev.filter(f => f.id !== file.id)];
      if (activePackId) {
        const packData = getPackData(activePackId);
        packData.customFiles = updated;
        const curVer = packSettings.currentVersion || "v1.0.0";
        if (!packData.releases) packData.releases = {};
        if (!packData.releases[curVer]) {
          packData.releases[curVer] = {
            releaseId: curVer,
            minecraft: packSettings.mcVersion,
            loader: { type: packSettings.loader, version: packSettings.loaderVersion || "latest" },
            installedContent: installedContent,
            customFiles: updated,
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        } else {
          packData.releases[curVer].customFiles = updated;
          packData.releases[curVer].updatedAt = new Date().toISOString();
        }
        savePackData(activePackId, packData);
      }
      return updated;
    });
  };

  const addCustomFilesBatch = (newFiles: CustomFileItem[]) => {
    if (!newFiles || newFiles.length === 0) return;
    setCustomFiles(prev => {
      const newPaths = new Set(newFiles.map(f => (f.targetPath || f.name).toLowerCase().replace(/^\/+/, "")));
      const filteredPrev = prev.filter(f => !newPaths.has((f.targetPath || f.name).toLowerCase().replace(/^\/+/, "")));
      const updated = [...newFiles, ...filteredPrev];

      if (activePackId) {
        const packData = getPackData(activePackId);
        packData.customFiles = updated;
        const curVer = packSettings.currentVersion || "v1.0.0";
        if (!packData.releases) packData.releases = {};
        if (!packData.releases[curVer]) {
          packData.releases[curVer] = {
            releaseId: curVer,
            minecraft: packSettings.mcVersion,
            loader: { type: packSettings.loader, version: packSettings.loaderVersion || "latest" },
            installedContent: installedContent,
            customFiles: updated,
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        } else {
          packData.releases[curVer].customFiles = updated;
          packData.releases[curVer].updatedAt = new Date().toISOString();
        }
        savePackData(activePackId, packData);
      }
      return updated;
    });
  };

  const updateCustomFile = (file: CustomFileItem) => {
    setCustomFiles(prev => {
      const updated = prev.map(f => f.id === file.id ? file : f);
      if (activePackId) {
        const packData = getPackData(activePackId);
        packData.customFiles = updated;
        const curVer = packSettings.currentVersion || "v1.0.0";
        if (!packData.releases) packData.releases = {};
        if (packData.releases[curVer]) {
          packData.releases[curVer].customFiles = updated;
          packData.releases[curVer].updatedAt = new Date().toISOString();
        }
        savePackData(activePackId, packData);
      }
      return updated;
    });
  };

  const removeCustomFile = (id: string) => {
    setCustomFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      if (activePackId) {
        const packData = getPackData(activePackId);
        packData.customFiles = updated;
        const curVer = packSettings.currentVersion || "v1.0.0";
        if (!packData.releases) packData.releases = {};
        if (packData.releases[curVer]) {
          packData.releases[curVer].customFiles = updated;
          packData.releases[curVer].updatedAt = new Date().toISOString();
        }
        savePackData(activePackId, packData);
      }
      return updated;
    });
  };

  const removeCustomFilesBatch = (idsToRemove: string[]) => {
    if (!idsToRemove || idsToRemove.length === 0) return;
    const removeSet = new Set(idsToRemove);
    setCustomFiles(prev => {
      const updated = prev.filter(f => !removeSet.has(f.id));
      if (activePackId) {
        const packData = getPackData(activePackId);
        packData.customFiles = updated;
        const curVer = packSettings.currentVersion || "v1.0.0";
        if (!packData.releases) packData.releases = {};
        if (packData.releases[curVer]) {
          packData.releases[curVer].customFiles = updated;
          packData.releases[curVer].updatedAt = new Date().toISOString();
        }
        savePackData(activePackId, packData);
      }
      return updated;
    });
  };

  const removeCustomFolder = (folderPath: string) => {
    const cleanFolder = folderPath.replace(/^\/+/, "").replace(/\/+$/, "");
    setCustomFiles(prev => {
      const updated = prev.filter(file => {
        const cleanPath = (file.targetPath || file.name).replace(/^\/+/, "");
        return !(cleanPath === cleanFolder || cleanPath.startsWith(`${cleanFolder}/`));
      });
      if (activePackId) {
        const packData = getPackData(activePackId);
        packData.customFiles = updated;
        const curVer = packSettings.currentVersion || "v1.0.0";
        if (!packData.releases) packData.releases = {};
        if (packData.releases[curVer]) {
          packData.releases[curVer].customFiles = updated;
          packData.releases[curVer].updatedAt = new Date().toISOString();
        }
        savePackData(activePackId, packData);
      }
      return updated;
    });
  };

  return (
    <PackContext.Provider
      value={{
        packSettings,
        packagesList,
        activePackId,
        createPack,
        importPack,
        switchPack,
        deletePack,
        updatePackSettings,
        createNewVersion,
        deleteVersion,
        getMinecraftVersions,
        getLoaders,
        loaders: getLoaders(false),
        isLoadingVersions,
        installedContent,
        addContent,
        removeContent,
        customFiles,
        addCustomFile,
        addCustomFilesBatch,
        updateCustomFile,
        removeCustomFile,
        removeCustomFilesBatch,
        removeCustomFolder,
        isCreatePackModalOpen,
        setIsCreatePackModalOpen,
        verifiedItems,
        setVerifiedItems,
        isVerifying,
        verifyPackContents,
      }}
    >
      {children}
    </PackContext.Provider>
  );
}

export function usePack(): PackContextType {
  const context = useContext(PackContext);
  if (!context) {
    throw new Error("usePack must be used within a PackProvider");
  }
  return context;
}
