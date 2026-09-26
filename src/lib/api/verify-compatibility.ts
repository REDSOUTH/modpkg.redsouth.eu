import { InstalledItem } from "@/types";
import { getModVersions } from "./mods";

export interface VerificationResult {
  isCompatible: boolean;
  reason?: string;
}

export async function checkItemCompatibility(
  item: InstalledItem,
  mcVersion: string,
  loader: string
): Promise<VerificationResult> {
  const versionId = (item.versionId || "latest").trim();
  const isLatestUnstable = versionId === "latest-unstable";
  const isLatest = versionId === "latest";
  const isCustom = item.provider === "custom" || item.provider === "local_override" || versionId === "custom";
  const isFixedVersion = !isLatest && !isLatestUnstable && !isCustom;

  // 1. Custom / Local Override resources
  if (isCustom) {
    const isShader = item.contentType === "shader" || item.contentType === "shaders";
    const isResourcePack = item.contentType === "resourcepack" || item.contentType === "textures" || item.contentType === "resourcepacks";
    const isDatapack = item.contentType === "datapack" || item.contentType === "datapacks";
    const isWorld = item.contentType === "world" || item.contentType === "worlds" || item.contentType === "save" || item.contentType === "saves";
    const loaderCheckNeeded = !isShader && !isResourcePack && !isDatapack && !isWorld;

    const matchMC = !item.mcVersion || item.mcVersion === "Any" || isShader || item.mcVersion.split(",").map(s => s.trim()).includes(mcVersion);
    const matchLoader = !loaderCheckNeeded || !item.loader || item.loader === "Any" || item.loader.split(",").map(s => s.trim().toLowerCase()).includes(loader.toLowerCase());
    return { 
      isCompatible: Boolean(matchMC && matchLoader),
      reason: matchMC && matchLoader ? undefined : `Incompatible con Minecraft ${mcVersion} (${loader})`,
    };
  }

  // 2. Modrinth / CurseForge: reuse getModVersions (the exact same resolution used to display versions in the UI)
  try {
    const rawProvider = item.provider || "modrinth";
    let versions = await getModVersions(
      rawProvider === "all" ? "modrinth" : rawProvider,
      item.id,
      mcVersion,
      loader,
      item.contentType
    );

    // Fallback for "all" provider: if not found on Modrinth, check CurseForge
    if (versions.length === 0 && rawProvider === "all") {
      versions = await getModVersions("curseforge", item.id, mcVersion, loader, item.contentType);
    }

    if (versions.length === 0) {
      return {
        isCompatible: false,
        reason: `No hay versiones disponibles para Minecraft ${mcVersion || "Any"} (${loader})`,
      };
    }

    if (isLatest) {
      const hasStable = versions.some((v) => v.stable);
      return {
        isCompatible: hasStable,
        reason: hasStable ? undefined : `No hay versión estable disponible para Minecraft ${mcVersion || "Any"} (${loader})`,
      };
    }

    if (isLatestUnstable) {
      return {
        isCompatible: versions.length > 0,
        reason: versions.length > 0 ? undefined : `No hay versiones disponibles para Minecraft ${mcVersion || "Any"} (${loader})`,
      };
    }

    // Fixed version: must match one of the available versions for this mcVersion & loader
    const match = versions.some(
      (v) => v.id === versionId || v.name === item.versionName || (item.fileName && v.fileName === item.fileName)
    );

    return {
      isCompatible: match,
      reason: match
        ? undefined
        : `La versión fija (${item.versionName || versionId}) no es compatible con Minecraft ${mcVersion} (${loader})`,
    };
  } catch (err: any) {
    return {
      isCompatible: false,
      reason: err?.message || "Error al verificar compatibilidad",
    };
  }
}
