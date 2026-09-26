import JSZip from "jszip";
import { InstalledItem, CustomFileItem, PackSettings, ModVersion } from "@/types";
import { generateModpkgExport, generateModpkgProjectExport, getSafePackageId } from "./export-package";
import { getCurseforgeProxyUrl } from "@/lib/api/curseforge";
import { getModVersions } from "@/lib/api/mods";

export interface ZipExportProgress {
  percentage: number;
  currentStep: string;
  completedItems: number;
  totalItems: number;
}

export interface FailedItemReport {
  id: string;
  name: string;
  provider: string;
  reason: string;
  url?: string;
}

export interface ExportZipOptions {
  includeVersionIndex: boolean;
  includeProjectFile: boolean;
  verifiedItemIds?: string[];
  onProgress?: (progress: ZipExportProgress) => void;
}

export interface ExportZipResult {
  success: boolean;
  totalProcessed: number;
  failedItems: FailedItemReport[];
  successfulItemIds: string[];
  compatibleItemIds: string[];
  fileName: string;
}

function getFolderForType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t === "resourcepack" || t === "textures" || t === "resourcepacks") return "resourcepacks";
  if (t === "shader" || t === "shaders" || t === "shaderpack" || t === "shaderpacks") return "shaderpacks";
  if (t === "datapack" || t === "datapacks") return "datapacks";
  if (t === "world" || t === "worlds" || t === "save" || t === "saves") return "saves";
  return "mods";
}

async function resolveItemFile(
  item: InstalledItem,
  mcVersion: string,
  loader: string
): Promise<{ url: string; fileName: string }> {
  // 1. Custom / local override content
  if (item.provider === "custom" || item.provider === "local_override") {
    const downloadUrl = item.downloadUrl;
    if (!downloadUrl) throw new Error("No hay URL de descarga para este contenido personalizado");
    const ext = item.contentType === "resourcepack" ? "zip" : "jar";
    const fileName = downloadUrl.split("/").pop()?.split("?")[0] || `${item.name}.${ext}`;
    return { url: downloadUrl, fileName };
  }

  // 2. Modrinth / CurseForge / all providers: query getModVersions for full parity with UI
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
    throw new Error(`No hay versiones compatibles para Minecraft ${mcVersion || "Any"} (${loader})`);
  }

  const versionId = (item.versionId || "latest").trim();
  let targetVer: ModVersion | undefined;

  if (versionId === "latest-unstable") {
    targetVer = versions[0];
  } else if (versionId === "latest") {
    // Buscar primero versión estable; si no existe, usar la última disponible (unstable)
    targetVer = versions.find((v) => v.stable) || versions[0];
  } else {
    // Versión fija
    targetVer =
      versions.find((v) => v.id === versionId) ||
      versions.find((v) => v.name === item.versionName) ||
      (item.fileName ? versions.find((v) => v.fileName === item.fileName) : undefined) ||
      versions[0];
  }

  if (!targetVer) {
    throw new Error(`No se pudo determinar la versión para ${item.name}`);
  }

  let downloadUrl = targetVer.downloadUrl;
  let fileName = targetVer.fileName;

  // Si es CurseForge y la URL de descarga directa no vino en la lista, consultar endpoint de descarga
  if (!downloadUrl && (rawProvider === "curseforge" || item.provider === "curseforge")) {
    try {
      const res = await fetch(getCurseforgeProxyUrl(`/v1/mods/${item.id}/files/${targetVer.id}/download-url`));
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          downloadUrl = json.data;
        }
      }
    } catch {
      // ignore and fallback
    }
  }

  if (!downloadUrl && item.downloadUrl) {
    downloadUrl = item.downloadUrl;
  }

  if (!downloadUrl) {
    throw new Error(`El archivo de ${item.name} (${targetVer.name}) no permite descarga directa por restricciones del autor`);
  }

  const defaultExt = item.contentType === "resourcepack" || item.contentType === "world" ? "zip" : "jar";
  return {
    url: downloadUrl,
    fileName: fileName || `${item.name}.${defaultExt}`,
  };
}

export async function exportModpkgZip(
  packSettings: PackSettings,
  installedContent: InstalledItem[],
  customFiles: CustomFileItem[],
  options: ExportZipOptions
): Promise<ExportZipResult> {
  const zip = new JSZip();
  const failedItems: FailedItemReport[] = [];
  const successfulItemIds: string[] = [];
  const compatibleItemIds: string[] = [];
  const safeId = getSafePackageId(packSettings);

  const totalContent = (installedContent || []).length;
  const totalOverrides = (customFiles || []).length;
  const totalSteps = totalContent + totalOverrides + 2; // + index/project + packaging
  let currentStepIdx = 0;

  const updateProgress = (stepName: string) => {
    currentStepIdx++;
    const percentage = Math.min(Math.round((currentStepIdx / totalSteps) * 90), 90);
    options.onProgress?.({
      percentage,
      currentStep: stepName,
      completedItems: currentStepIdx,
      totalItems: totalSteps,
    });
  };

  // 1. Process and download installed content
  for (const item of installedContent || []) {
    // Si ya se verificó previamente y este elemento no estaba verificado, saltar
    if (options.verifiedItemIds && options.verifiedItemIds.length > 0 && !options.verifiedItemIds.includes(item.id)) {
      failedItems.push({
        id: item.id,
        name: item.name,
        provider: item.provider,
        reason: `No verificado / incompatible con Minecraft ${packSettings.mcVersion} (${packSettings.loader})`,
        url: item.downloadUrl,
      });
      continue;
    }

    updateProgress(`Descargando ${item.name}...`);
    try {
      const resolved = await resolveItemFile(item, packSettings.mcVersion, packSettings.loader);
      compatibleItemIds.push(item.id);

      const downloadUrl = resolved.url;
      const finalFileName = resolved.fileName;
      const folder = getFolderForType(item.contentType);
      const targetFilePath = item.targetPath
        ? (item.targetPath.startsWith("/") ? item.targetPath.slice(1) : item.targetPath)
        : `${folder}/${finalFileName}`;

      let fetchUrl = downloadUrl;
      const isForgeCdn = downloadUrl.includes("forgecdn.net");

      if (isForgeCdn) {
        fetchUrl = `/api/download-proxy?url=${encodeURIComponent(downloadUrl)}`;
      }

      let fileRes: Response;
      try {
        fileRes = await fetch(fetchUrl);
        if (!fileRes.ok && fetchUrl !== downloadUrl) {
          fileRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(downloadUrl)}`);
        }
      } catch (fetchErr) {
        fileRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(downloadUrl)}`);
      }

      if (!fileRes.ok) throw new Error(`HTTP error ${fileRes.status} al descargar archivo`);
      const blob = await fileRes.blob();
      zip.file(targetFilePath, blob);
      successfulItemIds.push(item.id);
    } catch (err: any) {
      console.warn(`Failed to package item ${item.name}:`, err);
      failedItems.push({
        id: item.id,
        name: item.name,
        provider: item.provider,
        reason: err.message || "Error al descargar",
        url: item.downloadUrl,
      });
    }
  }

  // 2. Process and package overrides (customFiles)
  for (const file of customFiles || []) {
    updateProgress(`Empaquetando archivo personalizado ${file.name}...`);
    try {
      const cleanPath = file.targetPath?.startsWith("/") ? file.targetPath.slice(1) : (file.targetPath || file.name);
      if (file.sourceUrl) {
        let fetchUrl = file.sourceUrl;
        if (file.sourceUrl.includes("forgecdn.net")) {
          fetchUrl = `/api/download-proxy?url=${encodeURIComponent(file.sourceUrl)}`;
        }
        let res: Response;
        try {
          res = await fetch(fetchUrl);
          if (!res.ok && fetchUrl !== file.sourceUrl) {
            res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(file.sourceUrl)}`);
          }
        } catch {
          res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(file.sourceUrl)}`);
        }
        if (!res.ok) throw new Error(`HTTP error ${res.status} al descargar override`);
        const blob = await res.blob();
        zip.file(cleanPath, blob);
      } else if (file.isBinary && file.content?.startsWith("data:")) {
        const base64Data = file.content.split(",")[1];
        zip.file(cleanPath, base64Data, { base64: true });
      } else {
        zip.file(cleanPath, file.content ?? "");
      }
    } catch (err: any) {
      console.warn(`Failed to package custom file ${file.name}:`, err);
      failedItems.push({
        id: file.id,
        name: file.name,
        provider: "custom_file",
        reason: err.message || "Fallo al incluir override",
        url: file.sourceUrl,
      });
    }
  }

  // 3. Optional Inclusions
  if (options.includeVersionIndex) {
    updateProgress("Generando índice .mpkg...");
    const indexData = generateModpkgExport(packSettings, installedContent, customFiles);
    zip.file(`${safeId}.mpkg`, JSON.stringify(indexData, null, 2));
  }

  if (options.includeProjectFile) {
    updateProgress("Generando archivo de proyecto .mpkg-proj...");
    const projectData = generateModpkgProjectExport(packSettings, installedContent, customFiles);
    zip.file(`${safeId}.mpkg-proj`, JSON.stringify(projectData, null, 2));
  }

  // 4. Generate final ZIP
  options.onProgress?.({
    percentage: 92,
    currentStep: "Comprimiendo y finalizando paquete ZIP...",
    completedItems: totalSteps,
    totalItems: totalSteps,
  });

  const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
    const pct = 90 + Math.round(metadata.percent * 0.1);
    options.onProgress?.({
      percentage: pct,
      currentStep: `Comprimiendo ZIP (${Math.round(metadata.percent)}%)...`,
      completedItems: totalSteps,
      totalItems: totalSteps,
    });
  });

  // 5. Trigger download
  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  const fileName = `${safeId}.mpkg.zip`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  options.onProgress?.({
    percentage: 100,
    currentStep: "¡Exportación completada!",
    completedItems: totalSteps,
    totalItems: totalSteps,
  });

  return {
    success: true,
    totalProcessed: totalContent + totalOverrides,
    failedItems,
    successfulItemIds,
    compatibleItemIds,
    fileName,
  };
}
