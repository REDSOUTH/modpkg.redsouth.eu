import { Plus, Check, X, ExternalLink, Pencil, Download, Loader2, ChevronDown } from "lucide-react";
import { ProviderIcon } from "@/components/common/provider-icon";
import { ContentTypeIcon } from "@/components/common/content-type-icon";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { usePack } from "@/context/pack-context";
import { getModVersions } from "@/lib/api/mods";
import { ModVersion, CustomContentItem } from "@/types";
import { deleteCustomContentItem, getCustomContentItems } from "@/lib/storage/custom-content-storage";
import { AddCustomContentDialog } from "@/components/views/add-custom-content-dialog";
import notification from "@/functions/notification";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { getCurseforgeProxyUrl } from "@/lib/api/curseforge";

export type CardContentType = "mod" | "resourcepack" | "shader" | "datapack" | "world" | "override";
export type CardProviderType = "modrinth" | "curseforge" | "custom" | "local_override" | "all";

export interface ModItemData {
  id?: string;
  name: string;
  author: string;
  authorUrl?: string;
  iconUrl: string;
  description: string;
  categories: string[];
  provider?: CardProviderType;
  type?: CardContentType;
  versions?: string[];
  curseforgeId?: string | number;
  modrinthId?: string;
  slug?: string;
  websiteUrl?: string;
}

export interface ModCardComponentProps {
  mod: ModItemData;
  onCategoryClick?: (category: string) => void;
  onEditCustomItem?: (item: CustomContentItem) => void;
}

const normalizeType = (t: string) => {
  if (t === "mods") return "mod";
  if (t === "resourcepacks" || t === "textures") return "resourcepack";
  if (t === "shaders") return "shader";
  if (t === "datapacks") return "datapack";
  if (t === "worlds") return "world";
  return t;
};

const normalizeProvider = (p: string) => {
  if (p === "all" || !p) return "modrinth";
  return p;
};

const triggerBrowserDownload = (url: string, fileName?: string) => {
  const link = document.createElement("a");
  link.href = url;
  if (fileName) {
    link.download = fileName;
  }
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
  }, 200);
};

export default function ModCard({ mod, onCategoryClick, onEditCustomItem }: ModCardComponentProps) {
  const { t } = useTranslation();
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [versions, setVersions] = useState<ModVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  
  const { packSettings, installedContent, addContent, removeContent } = usePack();
  const { mcVersion, loader } = packSettings;
  
  const isAdded = installedContent.some(i => i.id === mod.id);
  const installedItem = installedContent.find(i => i.id === mod.id);
  const [selectedVersionId, setSelectedVersionId] = useState<string>(installedItem?.versionId || "latest");

  useEffect(() => {
    if (installedItem?.versionId) {
      setSelectedVersionId(installedItem.versionId);
    } else {
      setSelectedVersionId("latest");
    }
  }, [installedItem?.versionId, packSettings.id]);

  useEffect(() => {
    setVersions([]);
    if (!installedItem) {
      setSelectedVersionId("latest");
    }
  }, [mcVersion, loader, packSettings.id]);

  const selectedVersionName = selectedVersionId === "latest"
    ? t("editor.card.latest")
    : selectedVersionId === "latest-unstable"
      ? t("editor.card.latestUnstable")
      : versions.find(v => v.id === selectedVersionId)?.name || selectedVersionId;

  const isCustom = mod.provider === "custom";
  const globalCustomItems = getCustomContentItems();
  const isFromMyResources = isCustom && mod.id && globalCustomItems.some(i => i.id === mod.id);

  const handleAddAction = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (isAdded) {
      if (mod.id) removeContent(mod.id);
    } else {
      if (mod.id) {
        let versionIdToUse = isCustom ? "custom" : selectedVersionId;
        let versionName = isCustom ? "Custom URL" : selectedVersionName;

        // Si está en 'latest', verificar si solo tiene versiones unstable para seleccionar por defecto 'latest-unstable'
        if (versionIdToUse === "latest" && !isCustom) {
          try {
            let list = versions;
            if (list.length === 0) {
              list = await getModVersions(
                mod.provider || "modrinth",
                mod.id,
                mcVersion,
                loader,
                normalizeType(mod.type || "mod")
              );
              setVersions(list);
            }
            const hasStable = list.some(v => v.stable);
            if (!hasStable && list.length > 0) {
              versionIdToUse = "latest-unstable";
              versionName = t("editor.card.latestUnstable");
              setSelectedVersionId("latest-unstable");
            }
          } catch (err) {
            console.warn("Could not check versions for auto latest-unstable:", err);
          }
        }

        addContent({
          id: mod.id,
          name: mod.name,
          provider: isCustom ? "custom" : (normalizeProvider(mod.provider || "modrinth") as CardProviderType),
          iconUrl: mod.iconUrl,
          versionId: versionIdToUse,
          versionName: versionName,
          contentType: normalizeType(mod.type || "mod"),
          downloadUrl: isCustom ? ((mod as any).customItem?.downloadUrl || mod.websiteUrl || mod.description) : undefined,
          author: mod.author,
          mcVersion: (mod as any).mcVersion || packSettings.mcVersion,
          loader: (mod as any).loader || packSettings.loader,
          targetPath: (mod as any).targetPath,
          storageLocation: (mod as any).storageLocation,
          isPackageOnly: isCustom ? !isFromMyResources : undefined,
        });
      }
    }
  };

  const handleSelectVersion = (val: string, name?: string) => {
    setSelectedVersionId(val);
    if (mod.id && isAdded) {
      addContent({
        ...(installedItem || {}),
        id: mod.id,
        name: mod.name,
        provider: normalizeProvider(mod.provider || "modrinth") as CardProviderType,
        iconUrl: mod.iconUrl,
        versionId: val,
        versionName: val === "latest" ? "Latest" : val === "latest-unstable" ? "Latest Unstable" : name || versions.find(v => v.id === val)?.name || val,
        contentType: normalizeType(mod.type || "mod"),
        mcVersion: packSettings.mcVersion,
        loader: packSettings.loader,
      });
    }
  };

  const handleDirectDownload = async (targetVersionIdOverride?: string) => {
    if (isDownloading) return;

    const versionToUse = targetVersionIdOverride || selectedVersionId;

    try {
      setIsDownloading(true);

      // 1. Custom content
      if (isCustom) {
        const customUrl = (mod as any).customItem?.downloadUrl || mod.websiteUrl || mod.description;
        if (!customUrl || !customUrl.startsWith("http")) {
          notification.error(t("toast.noDirectDownloadUrl"));
          return;
        }
        const ext = normalizeType(mod.type || "mod") === "resourcepack" ? "zip" : "jar";
        const filename = customUrl.split("/").pop()?.split("?")[0] || `${mod.name}.${ext}`;
        triggerBrowserDownload(customUrl, filename);
        notification.success(t("toast.downloading", { name: mod.name }));
        return;
      }

      // 2. Modrinth / CurseForge
      const provider = normalizeProvider(mod.provider || "modrinth");
      const modId = mod.id;
      if (!modId) {
        notification.error(t("toast.contentIdNotFound"));
        return;
      }

      let currentVersionsList = versions;
      if (currentVersionsList.length === 0) {
        setIsLoadingVersions(true);
        currentVersionsList = await getModVersions(
          provider,
          modId,
          mcVersion,
          loader,
          normalizeType(mod.type || "mod")
        );
        setVersions(currentVersionsList);
        setIsLoadingVersions(false);
      }

      if (currentVersionsList.length === 0) {
        notification.warn(t("toast.noCompatibleFiles", { mcVersion, loader }));
        return;
      }

      // Resolve version object to download
      let targetVer: ModVersion | undefined;
      if (versionToUse === "latest-unstable") {
        targetVer = currentVersionsList[0];
      } else if (versionToUse === "latest") {
        targetVer = currentVersionsList.find(v => v.stable);
      } else {
        targetVer = currentVersionsList.find(v => v.id === versionToUse) || currentVersionsList[0];
      }

      if (!targetVer) {
        notification.error(t("toast.noCompatibleFiles", { mcVersion, loader }));
        return;
      }

      let downloadUrl = targetVer.downloadUrl;
      let fileName = targetVer.fileName;

      // Special handling for CurseForge if downloadUrl was not included in file list
      if (provider === "curseforge" && !downloadUrl) {
        try {
          const res = await fetch(getCurseforgeProxyUrl(`/v1/mods/${modId}/files/${targetVer.id}/download-url`));
          if (res.ok) {
            const resJson = await res.json();
            if (resJson?.data) {
              downloadUrl = resJson.data;
            }
          }
        } catch {
          // fallback below
        }
      }

      const isResPack = normalizeType(mod.type || "mod") === "resourcepack";
      const isWorld = normalizeType(mod.type || "mod") === "world";
      const ext = isResPack || isWorld ? "zip" : "jar";
      const cfSection = isWorld ? "worlds" : isResPack ? "texture-packs" : "mc-mods";

      // Fallback for Curseforge if direct download URL is restricted by author
      if (!downloadUrl && provider === "curseforge") {
        const fallbackUrl = `https://www.curseforge.com/minecraft/${cfSection}/${mod.slug || modId}/download/${targetVer.id}`;
        triggerBrowserDownload(fallbackUrl, fileName || `${mod.name}.${ext}`);
        notification.success(t("toast.openingDownload", { name: mod.name, version: targetVer.name }));
        return;
      }

      if (!downloadUrl) {
        notification.error(t("toast.noDownloadUrl", { name: mod.name }));
        return;
      }

      triggerBrowserDownload(downloadUrl, fileName || `${mod.name}.${ext}`);
      notification.success(t("toast.downloadingWithVersion", { name: mod.name, version: targetVer.name }));
    } catch (err: any) {
      console.error("Direct download error:", err);
      notification.error(t("toast.downloadFailed", { name: mod.name, error: err?.message || "Unknown error" }));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenChange = async (open: boolean) => {
    if (open && versions.length === 0 && !isLoadingVersions && mod.id && !isCustom) {
      setIsLoadingVersions(true);
      const fetched = await getModVersions(
        mod.provider || "modrinth", 
        mod.id, 
        mcVersion, 
        loader, 
        normalizeType(mod.type || "mod")
      );
      setVersions(fetched);
      setIsLoadingVersions(false);

      // Si solo hay versiones unstable y estaba en 'latest', pre-seleccionar 'latest-unstable'
      const hasStable = fetched.some(v => v.stable);
      if (!hasStable && fetched.length > 0 && selectedVersionId === "latest") {
        setSelectedVersionId("latest-unstable");
        if (isAdded) {
          addContent({
            ...(installedItem || {}),
            id: mod.id,
            name: mod.name,
            provider: normalizeProvider(mod.provider || "modrinth") as CardProviderType,
            iconUrl: mod.iconUrl,
            versionId: "latest-unstable",
            versionName: t("editor.card.latestUnstable"),
            contentType: normalizeType(mod.type || "mod"),
            mcVersion: packSettings.mcVersion,
            loader: packSettings.loader,
          });
        }
      }
    }
  };

  const getProjectUrl = () => {
    if (mod.websiteUrl) return mod.websiteUrl;
    const provider = normalizeProvider(mod.provider || "modrinth");
    const identifier = mod.slug || mod.id || mod.name.toLowerCase().replace(/ /g, "");
    const isWorld = normalizeType(mod.type || "mod") === "world";
    const isResPack = normalizeType(mod.type || "mod") === "resourcepack";
    const cfSection = isWorld ? "worlds" : isResPack ? "texture-packs" : "mc-mods";
    
    if (provider === "curseforge") {
      return `https://www.curseforge.com/minecraft/${cfSection}/${identifier}`;
    }
    return `https://modrinth.com/mod/${identifier}`;
  };

  const getAuthorUrl = () => {
    if (mod.authorUrl) return mod.authorUrl;
    const provider = normalizeProvider(mod.provider || "modrinth");
    
    if (provider === "curseforge") {
      return `https://www.curseforge.com/members/${mod.author}/projects`;
    }
    return `https://modrinth.com/user/${mod.author}`;
  };

  const handleOpenProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mod.websiteUrl) {
      window.open(mod.websiteUrl, '_blank');
    }
  };

  const handleOpenAuthor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCustom) {
      window.open(getAuthorUrl(), '_blank');
    }
  };

  return (
    <motion.div 
      onClick={handleAddAction}
      className="group relative bg-card dark:bg-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-4 overflow-hidden ring-1 ring-inset ring-border/50 dark:ring-0 outline outline-3 outline-transparent transition-[outline,outline-offset,box-shadow,background-color] duration-150 hover:outline-[#FE5000] hover:outline-offset-4 active:scale-[0.98] cursor-pointer h-full shadow-sm dark:shadow-none"
    >

      <div className="flex items-start justify-between relative z-10 w-full">
        
        {/* Title container with dynamic right padding to prevent button overlap */}
        <div className={`flex gap-3.5 items-center min-w-0 w-full ${isCustom ? 'pr-10' : 'pr-20'}`}>
          
          {/* Icon rendering with light grey MODPKG logo fallback */}
          {mod.iconUrl && !imageError ? (
            <img 
              src={mod.iconUrl} 
              alt={mod.name} 
              onError={() => setImageError(true)}
              className="w-14 h-14 rounded-xl bg-black object-cover transition-colors select-none cursor-pointer shrink-0"
              draggable={false}
              onClick={handleOpenProject}
              onMouseEnter={() => setIsTitleHovered(true)}
              onMouseLeave={() => setIsTitleHovered(false)}
            />
          ) : (
            <div 
              className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0 cursor-pointer p-3 select-none"
              onClick={handleOpenProject}
              onMouseEnter={() => setIsTitleHovered(true)}
              onMouseLeave={() => setIsTitleHovered(false)}
            >
              <ContentTypeIcon type={mod.type || "mod"} iconClassName="w-7 h-7 text-muted-foreground" />
            </div>
          )}

          <div className="flex flex-col justify-center gap-0.5 min-w-0 flex-1">
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-1.5 cursor-pointer min-w-0 max-w-full w-fit"
                    onClick={handleOpenProject}
                    onMouseEnter={() => setIsTitleHovered(true)}
                    onMouseLeave={() => setIsTitleHovered(false)}
                  >
                    <h4 className={`font-semibold text-base leading-tight truncate ${isTitleHovered ? 'text-[#FE5000] underline' : 'text-foreground'}`}>
                      {mod.name}
                    </h4>
                    {mod.websiteUrl && (
                      <ExternalLink className={`w-3.5 h-3.5 text-[#FE5000] transition-opacity shrink-0 ${isTitleHovered ? 'opacity-100' : 'opacity-0'}`} />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="shadow-xl text-xs rounded-lg p-2 max-w-xs z-50">
                  <p className="font-semibold">{mod.name}</p>
                  <p className="text-[10px] text-muted-foreground">{mod.author}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Subline: Author */}
            <div 
              className="flex items-center gap-1.5 text-muted-foreground text-xs w-fit group/author cursor-pointer mt-0.5"
              onClick={handleOpenAuthor}
            >
              <span className="truncate transition-colors group-hover/author:text-[#FE5000] group-hover/author:underline">
                {mod.author}
              </span>
              {!isCustom && (
                <ExternalLink className="w-3 h-3 text-[#FE5000] transition-opacity opacity-0 group-hover/author:opacity-100 shrink-0" />
              )}
            </div>
          </div>
        </div>
        
        {/* Add button & Version Select Group */}
        {isCustom ? (
          /* For Custom Content: Show + / Check button AND Edit button */
          <div 
            className={`absolute top-0 right-0 flex items-center ml-2 rounded-full overflow-hidden transition-all flex-shrink-0 shadow-sm z-30 ${
              isAdded 
                ? "bg-[#FE5000] text-white shadow-lg shadow-[#FE5000]/25 border border-transparent" 
                : "bg-muted dark:bg-black text-foreground hover:bg-muted/80 dark:hover:bg-neutral-900 border border-border dark:border-white/5"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className={`group/btn w-8 h-8 flex items-center justify-center transition-all ${
                      isAdded ? "hover:bg-white/20 text-white" : "hover:bg-foreground/10 dark:hover:bg-white/20"
                    }`}
                    onClick={handleAddAction}
                  >
                    {!isAdded && <Plus className="w-4 h-4" />}
                    {isAdded && (
                      <>
                        <Check className="w-4 h-4 block group-hover/btn:hidden" />
                        <X className="w-4 h-4 hidden group-hover/btn:block" />
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p>{isAdded ? t("editor.card.removeFromPackage") : t("editor.card.addToPackage")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className={`w-px h-4 transition-colors ${isAdded ? "bg-white/20" : "bg-border dark:bg-white/20"}`} />

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className={`w-8 h-8 flex items-center justify-center transition-all ${
                      isAdded ? "hover:bg-white/20 text-white/90" : "hover:bg-foreground/10 dark:hover:bg-white/20 text-foreground/80"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const customData: CustomContentItem = (mod as any).customItem || {
                        id: mod.id || "custom",
                        name: mod.name,
                        contentType: normalizeType(mod.type || "mod"),
                        downloadUrl: mod.websiteUrl || mod.description || "",
                        author: mod.author,
                        mcVersion: (mod as any).mcVersion || "Any",
                        loader: (mod as any).loader || "Any",
                        storageLocation: "local_browser",
                        createdAt: new Date().toISOString(),
                      };
                      onEditCustomItem?.(customData);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p>{t("editor.card.editCustomContent")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          /* Standard Provider Card: Show + Button AND Version/Download Dropdown Trigger */
          <div 
            className={`absolute top-0 right-0 flex items-center ml-2 rounded-full overflow-hidden transition-all flex-shrink-0 shadow-sm z-30 ${
              isAdded 
                ? "bg-[#FE5000] text-white shadow-lg shadow-[#FE5000]/25 border border-transparent" 
                : "bg-muted dark:bg-black text-foreground hover:bg-muted/80 dark:hover:bg-neutral-900 border border-border dark:border-white/5"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className={`group/btn w-8 h-8 flex items-center justify-center transition-all ${
                      isAdded ? "hover:bg-white/20 text-white" : "hover:bg-foreground/10 dark:hover:bg-white/20"
                    }`}
                    onClick={handleAddAction}
                  >
                    {!isAdded && <Plus className="w-4 h-4" />}
                    {isAdded && (
                      <>
                        <Check className="w-4 h-4 block group-hover/btn:hidden" />
                        <X className="w-4 h-4 hidden group-hover/btn:block" />
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p>{isAdded ? t("editor.card.removeFromPackage") : t("editor.card.addToPackageVersion", { version: selectedVersionName })}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className={`w-px h-4 transition-colors ${isAdded ? "bg-white/20" : "bg-border dark:bg-white/20"}`} />

            <DropdownMenu onOpenChange={handleOpenChange}>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={`w-8 h-8 p-0 border-none bg-transparent focus:ring-0 shadow-none flex items-center justify-center rounded-none transition-colors outline-none cursor-pointer ${
                          isAdded 
                            ? "hover:bg-white/20 text-white" 
                            : "hover:bg-foreground/10 dark:hover:bg-white/20 text-foreground dark:text-white"
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p>{t("editor.card.versionsAndDownload", { version: selectedVersionName })}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <DropdownMenuContent 
                align="end" 
                sideOffset={4}
                className="bg-popover text-popover-foreground border border-border dark:border-[#333333] rounded-xl shadow-xl z-50 w-72 p-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1. Label de versiones */}
                <DropdownMenuLabel className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground px-2.5 pt-1.5 pb-1">
                  {t("editor.card.versionsHeader", { mcVersion, loader })}
                </DropdownMenuLabel>

                {/* 2. Lista nativa de selección de versión con truncate estricto */}
                <ScrollArea className="max-h-60 w-full [&>[data-radix-scroll-area-viewport]>div]:!block pr-1">
                  <div className="space-y-0.5 w-full max-w-full">
                    {/* Latest */}
                    <DropdownMenuItem
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer focus:bg-muted font-medium w-full min-w-0"
                      onSelect={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectVersion("latest");
                      }}
                    >
                      <span className={`truncate min-w-0 flex-1 block ${selectedVersionId === "latest" ? "font-semibold text-[#FE5000]" : "text-foreground"}`}>
                        {t("editor.card.latest")}
                      </span>
                      {selectedVersionId === "latest" && (
                        <Check className="w-3.5 h-3.5 text-[#FE5000] shrink-0 ml-2" />
                      )}
                    </DropdownMenuItem>

                    {/* Latest Unstable */}
                    <DropdownMenuItem
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer focus:bg-muted font-medium w-full min-w-0"
                      onSelect={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectVersion("latest-unstable");
                      }}
                    >
                      <span className={`truncate min-w-0 flex-1 block ${selectedVersionId === "latest-unstable" ? "font-semibold text-[#FE5000]" : "text-foreground"}`}>
                        {t("editor.card.latestUnstable")}
                      </span>
                      {selectedVersionId === "latest-unstable" && (
                        <Check className="w-3.5 h-3.5 text-[#FE5000] shrink-0 ml-2" />
                      )}
                    </DropdownMenuItem>

                    {isLoadingVersions ? (
                      <div className="text-xs text-muted-foreground px-2 py-3 text-center animate-pulse flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FE5000]" />
                        <span>{t("editor.card.loadingVersions")}</span>
                      </div>
                    ) : versions.length === 0 ? (
                      <div className="text-xs text-muted-foreground px-2 py-2 text-center">
                        {t("editor.card.noVersionsFound")}
                      </div>
                    ) : (
                      versions.map((v) => {
                        const isSelected = selectedVersionId === v.id;
                        return (
                          <DropdownMenuItem
                            key={v.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer focus:bg-muted w-full min-w-0"
                            onSelect={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectVersion(v.id, v.name);
                            }}
                          >
                            {/* Name — truncates with Tooltip on hover with 500ms delay */}
                            <TooltipProvider delayDuration={500}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`truncate min-w-0 flex-1 block ${isSelected ? "font-semibold text-[#FE5000]" : "text-foreground"}`}>
                                    {v.name}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="z-[9999] text-xs max-w-xs break-all shadow-md">
                                  {v.name}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {/* Badges + check on the right */}
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              {!v.stable && (
                                <span className="text-[10px] text-muted-foreground font-normal shrink-0">{t("editor.card.unstable")}</span>
                              )}
                              {v.recommended && (
                                <span className="text-[10px] font-bold text-blue-500 shrink-0">★</span>
                              )}
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#FE5000] shrink-0" />
                              )}
                            </div>
                          </DropdownMenuItem>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* 3. Separador con el mismo ancho que el botón y más separación */}
                <DropdownMenuSeparator className="mx-0 my-2 h-px bg-border dark:bg-[#333333]" />

                {/* 4. Botón de descarga de la versión seleccionada */}
                <DropdownMenuItem
                  className="flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer bg-[#FE5000] text-white hover:bg-[#e04700] focus:bg-[#e04700] focus:text-white transition-colors shadow-sm shadow-[#FE5000]/20 font-medium text-xs group/dl"
                  onSelect={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDirectDownload();
                  }}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin shrink-0" />
                  ) : (
                    <Download className="w-4 h-4 text-white shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-white leading-tight">{t("editor.card.downloadDirectFile")}</span>
                    <span className="text-[10px] text-white/80 truncate">
                      {selectedVersionName} ({mcVersion} · {loader})
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 break-words relative z-10 mt-1 leading-relaxed">
        {mod.description}
      </p>

      {/* Footer tags */}
      <div className="flex items-end justify-between mt-auto pt-2 relative z-10 gap-2">
        
        {/* Categories tags */}
        {isFromMyResources ? (
          <div className="flex items-center gap-1.5 shrink min-w-0" onClick={(e) => e.stopPropagation()}>
            <Badge 
              variant="secondary" 
              className="bg-muted dark:bg-black text-muted-foreground rounded-md text-[10px] uppercase tracking-wider font-medium border border-border/50 dark:border-white/5 select-none cursor-default"
            >
              {t("editor.card.myResources")}
            </Badge>
          </div>
        ) : mod.categories && mod.categories.length > 0 ? (
          <div className="flex items-center gap-1.5 overflow-hidden max-w-[calc(100%-36px)] flex-nowrap">
            {mod.categories.slice(0, 2).map((cat) => (
              <Badge 
                key={cat} 
                variant="secondary" 
                className="bg-muted dark:bg-black hover:bg-muted/80 dark:hover:bg-neutral-900 text-muted-foreground hover:text-foreground rounded-md text-[10px] uppercase tracking-wider font-medium border border-border/50 dark:border-white/5 transition-colors cursor-pointer truncate shrink min-w-0 max-w-[120px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onCategoryClick?.(cat);
                }}
              >
                {cat}
              </Badge>
            ))}
            {mod.categories.length > 2 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex cursor-help shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Badge 
                        variant="secondary" 
                        className="bg-muted dark:bg-black hover:bg-muted/80 dark:hover:bg-neutral-900 text-muted-foreground hover:text-foreground rounded-md text-[10px] uppercase tracking-wider font-medium border border-border/50 dark:border-white/5 transition-colors shrink-0"
                      >
                        +{mod.categories.length - 2}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="shadow-xl p-2 z-50">
                    <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                      {mod.categories.slice(2).map((cat) => (
                        <Badge 
                          key={cat} 
                          variant="secondary" 
                          className="bg-muted dark:bg-black hover:bg-muted/80 dark:hover:bg-neutral-900 text-muted-foreground hover:text-foreground rounded-md text-[10px] uppercase tracking-wider font-medium border border-border/50 dark:border-white/5 transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCategoryClick?.(cat);
                          }}
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : <div />}
        
        {/* Provider Icon */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {mod.provider === "all" ? (
            <>
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted dark:bg-black border border-border/50 dark:border-white/5 transition-colors">
                <ProviderIcon provider="modrinth" size="sm" />
              </div>
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted dark:bg-black border border-border/50 dark:border-white/5 transition-colors">
                <ProviderIcon provider="curseforge" size="sm" />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted dark:bg-black border border-border/50 dark:border-white/5 transition-colors">
              <ProviderIcon provider={mod.provider || "modrinth"} size="sm" />
            </div>
          )}
        </div>
      </div>

    </motion.div>
  );
}
