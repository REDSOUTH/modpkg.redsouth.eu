import { Package, Download, Trash2, Pin, PinOff, Box, Paintbrush, Glasses, FileBraces, FileText, Layers, Braces, Map, PlusCircle, ShieldCheck, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ContentTypeFilterBadges, FilterBadgeItem } from "@/components/common/content-type-filter-badges";
import { ContentTypeIcon } from "@/components/common/content-type-icon";
import { ProviderIcon } from "@/components/common/provider-icon";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { usePack } from "@/context/pack-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExportModpkgDialog } from "@/components/views/export-modpkg-dialog";

export type ContentType = "mod" | "resourcepack" | "shader" | "datapack" | "world" | "override" | string;
export type ProviderType = "modrinth" | "curseforge" | "custom" | "local_override" | "all";

export interface SelectedDockProps {
  onItemClick?: (item: any) => void;
}

export default function SelectedDock({ onItemClick }: SelectedDockProps = {}) {
  const { t } = useTranslation();
  const { 
    packSettings, 
    installedContent, 
    customFiles, 
    removeContent, 
    verifiedItems, 
    isVerifying, 
    verifyPackContents 
  } = usePack();
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState<boolean>(false);

  const handleExportModpack = () => {
    setIsHovered(false);
    setIsExportDialogOpen(true);
  };
  
  // Persist pinned state in localStorage
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("modpkg_dock_pinned");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const [filterType, setFilterType] = useState<ContentType | "all">("all");

  const togglePin = () => {
    setIsPinned(prev => {
      const next = !prev;
      try {
        localStorage.setItem("modpkg_dock_pinned", String(next));
      } catch (e) {
        console.warn("Failed to save dock pinned state", e);
      }
      return next;
    });
  };

  const removeItem = (id: string) => {
    removeContent(id);
  };

  const handleVerify = async () => {
    if (isVerifying || installedContent.length === 0) return;
    toast.loading(t("editor.dock.verifyingProgress"), { id: "verify-pack" });
    const result = await verifyPackContents();
    if (result.failedNames.length === 0) {
      toast.success(
        t("editor.dock.verifySuccessAll", { 
          count: result.verifiedCount, 
          mc: packSettings.mcVersion, 
          loader: packSettings.loader 
        }), 
        { id: "verify-pack" }
      );
    } else {
      toast.warning(
        t("editor.dock.verifyWarningPartial", {
          verified: result.verifiedCount,
          total: result.totalCount,
          failed: result.failedNames.length,
        }),
        { id: "verify-pack" }
      );
    }
  };

  const isExpanded = isHovered || isPinned || isExportDialogOpen;

  // Breakdown statistics
  const modsCount = installedContent.filter(i => i.contentType === "mod").length;
  const resourcePacksCount = installedContent.filter(i => i.contentType === "resourcepack" || i.contentType === "textures").length;
  const datapacksCount = installedContent.filter(i => i.contentType === "datapack" || i.contentType === "datapacks").length;
  const shadersCount = installedContent.filter(i => i.contentType === "shader" || i.contentType === "shaders").length;
  const worldsCount = installedContent.filter(i => i.contentType === "world" || i.contentType === "worlds").length;
  const overridesCount = installedContent.filter(i => i.contentType === "override").length;
  
  const modrinthCount = installedContent.filter(i => i.provider === "modrinth").length;
  const curseforgeCount = installedContent.filter(i => i.provider === "curseforge").length;
  const customCount = installedContent.filter(i => i.provider === "custom").length;
  const localOverrideCount = installedContent.filter(i => i.provider === "local_override").length;

  const filteredItems = installedContent.filter(item => {
    if (filterType === "all") return true;
    if (filterType === "resourcepack") return item.contentType === "resourcepack" || item.contentType === "textures";
    if (filterType === "datapack") return item.contentType === "datapack" || item.contentType === "datapacks";
    if (filterType === "shader") return item.contentType === "shader" || item.contentType === "shaders";
    if (filterType === "world") return item.contentType === "world" || item.contentType === "worlds";
    return item.contentType === filterType;
  });

  const renderTypeIcon = (type: ContentType) => {
    switch (type) {
      case "mod":
        return <Box className="w-3.5 h-3.5 text-[#FE5000] shrink-0" />;
      case "resourcepack":
        return <Paintbrush className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case "shader":
        return <Glasses className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case "datapack":
        return <Braces className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "world":
        return <Map className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      case "override":
        return <FileBraces className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-white/50 shrink-0" />;
    }
  };

  return (
    <motion.aside
      className="border-l border-border bg-background flex flex-col flex-shrink-0 z-30 overflow-hidden sticky top-[121px] h-[calc(100vh-121px)]"
      initial={false}
      animate={{ width: isExpanded ? 340 : 80 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header: MODPKG Overview */}
      <div className="h-14 flex items-center shrink-0 relative border-b border-border w-full overflow-hidden">
        {/* Fixed 80px icon container matching collapsed dock width */}
        <div className="w-[80px] h-full flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-[#FE5000] shrink-0" />
        </div>

        {/* Title and items count */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col whitespace-nowrap overflow-hidden pr-12"
            >
              <span className="font-bold text-foreground text-sm tracking-wide">{t("editor.dock.overviewTitle")}</span>
              <span className="text-[10px] text-muted-foreground">{t("editor.dock.totalItems", { count: installedContent.length })}</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Pin button */}
        <AnimatePresence>
          {isExpanded && (
            <motion.button 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={togglePin}
              title={isPinned ? t("editor.dock.unpin") : t("editor.dock.pinOpen")}
              className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all absolute right-6 ${
                isPinned 
                  ? 'border-[#FE5000] text-[#FE5000] bg-[#FE5000]/10' 
                  : 'bg-muted border-border text-muted-foreground hover:border-[#FE5000] hover:text-[#FE5000]'
              }`}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <TooltipProvider delayDuration={400}>
        {/* Expanded Clickable Filter Tags Header */}
        {isExpanded && (
          <div className="pl-4 pr-6 py-4 border-b border-border flex flex-col gap-3 shrink-0">
            <ContentTypeFilterBadges
              showLabel={false}
              value={filterType}
              onValueChange={setFilterType}
              activeColorClass="bg-[#FE5000] text-white"
              items={[
                { id: "all", type: "all", label: t("editor.dock.all"), count: installedContent.length },
                ...(modsCount > 0 ? [{ id: "mod", type: "mod", label: t("editor.dock.mods"), count: modsCount }] : []),
                ...(resourcePacksCount > 0 ? [{ id: "resourcepack", type: "resourcepack", label: t("editor.dock.textures"), count: resourcePacksCount }] : []),
                ...(datapacksCount > 0 ? [{ id: "datapack", type: "datapack", label: t("editor.dock.datapacks"), count: datapacksCount }] : []),
                ...(shadersCount > 0 ? [{ id: "shader", type: "shader", label: t("editor.dock.shaders"), count: shadersCount }] : []),
                ...(worldsCount > 0 ? [{ id: "world", type: "world", label: t("editor.dock.worlds"), count: worldsCount }] : []),
                ...(overridesCount > 0 ? [{ id: "override", type: "override", label: t("editor.dock.overrides"), count: overridesCount }] : []),
              ]}
            />

            {/* Provider Breakdown Row */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border h-6 shrink-0">
              <span className="font-semibold uppercase tracking-wider text-[10px]">{t("editor.dock.sources")}</span>
              <div className="flex items-center gap-3">
                {modrinthCount > 0 && (
                  <span className="flex items-center gap-1.5 text-[#45D66F]" title="Modrinth">
                    <img src="/social/modrinth.svg" alt="Modrinth" className="w-3.5 h-3.5 min-w-[14px] min-h-[14px] max-w-[14px] max-h-[14px] object-contain shrink-0 select-none pointer-events-none" draggable={false} />
                    <span className="font-medium">{modrinthCount}</span>
                  </span>
                )}
                {curseforgeCount > 0 && (
                  <span className="flex items-center gap-1.5 text-[#F16436]" title="CurseForge">
                    <img src="/social/curseforge.svg" alt="CurseForge" className="w-3.5 h-3.5 min-w-[14px] min-h-[14px] max-w-[14px] max-h-[14px] object-contain shrink-0 select-none pointer-events-none" draggable={false} />
                    <span className="font-medium">{curseforgeCount}</span>
                  </span>
                )}
                {customCount > 0 && (
                  <span className="flex items-center gap-1.5 text-blue-400" title="Custom Source">
                    <PlusCircle className="w-3.5 h-3.5 min-w-[14px] min-h-[14px] shrink-0" />
                    <span className="font-medium">{customCount}</span>
                  </span>
                )}
                {localOverrideCount > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-400" title="Local Overrides">
                    <FileBraces className="w-3.5 h-3.5 min-w-[14px] min-h-[14px] shrink-0" />
                    <span className="font-medium">{localOverrideCount}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Verify Compatibility Button */}
            <button
              onClick={handleVerify}
              disabled={isVerifying || installedContent.length === 0}
              className="w-full h-8 px-3 rounded-lg border border-border bg-muted/60 hover:bg-muted text-xs font-medium flex items-center justify-center gap-2 text-foreground transition-all hover:border-emerald-500/50 hover:text-emerald-500 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  <span>{t("editor.dock.verifyingProgress")}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t("editor.dock.verifyCompatibility")}</span>
                  {verifiedItems.length > 0 && (
                    <span className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full font-bold">
                      {verifiedItems.length}/{installedContent.length}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        )}

        {/* Scrollable Content Items */}
        <ScrollArea className="flex-1 min-h-0 w-full overflow-hidden [&>div>div]:!block [&>div]:!block">
          <div className={`flex flex-col gap-2 transition-all w-full min-w-0 overflow-hidden ${isExpanded ? "pl-4 pr-6 py-4" : "py-4 px-0 items-center"}`}>
          <AnimatePresence>
            {filteredItems.map(item => {
              const isOverride = item.contentType === "override";

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ 
                    duration: 0.15,
                    ease: "easeOut"
                  }}
                  className={`flex items-center rounded-xl transition-colors group relative max-w-full ${
                    isExpanded 
                      ? "w-full min-w-0 overflow-hidden gap-3 p-2.5 bg-card dark:bg-[#141414] border border-border dark:border-[#1E1E1E] hover:bg-muted/80 dark:hover:bg-[#1E1E1E]" 
                      : "justify-center p-1 w-11 h-11 shrink-0 border border-transparent hover:bg-muted hover:border-border"
                  }`}
                >
                  {/* Item Image / Avatar */}
                  <div 
                    onClick={(e) => {
                      if (!isOverride && onItemClick) {
                        e.stopPropagation();
                        onItemClick(item);
                      }
                    }}
                    className={`shrink-0 flex items-center justify-center ${!isOverride ? "cursor-pointer" : ""}`}
                  >
                    {isOverride ? (
                      <div className="w-10 h-10 min-w-[40px] min-h-[40px] max-w-[40px] max-h-[40px] rounded-lg bg-muted flex items-center justify-center text-amber-400 shrink-0 border border-border select-none pointer-events-none">
                        <FileBraces className="w-5 h-5 text-amber-400 shrink-0" />
                      </div>
                    ) : item.iconUrl && item.iconUrl !== "/logo.svg" ? (
                      <img 
                        src={item.iconUrl} 
                        alt={item.name} 
                        className="w-10 h-10 min-w-[40px] min-h-[40px] max-w-[40px] max-h-[40px] rounded-lg bg-black shrink-0 object-cover border border-border select-none pointer-events-none" 
                        draggable={false}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                          const parent = (e.target as HTMLElement).parentElement;
                          if (parent) {
                            const fallback = document.createElement("div");
                            fallback.className = "w-10 h-10 min-w-[40px] min-h-[40px] max-w-[40px] max-h-[40px] rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border select-none pointer-events-none";
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 min-w-[40px] min-h-[40px] max-w-[40px] max-h-[40px] rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border select-none pointer-events-none">
                        <ContentTypeIcon type={item.contentType} iconClassName="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                      {/* Name with Tooltip on Hover */}
                      <div className="w-fit max-w-full">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isOverride && onItemClick) {
                                  onItemClick(item);
                                }
                              }}
                              className="font-medium text-sm text-foreground inline-block max-w-full truncate cursor-pointer hover:text-[#FE5000] transition-colors text-left align-bottom"
                            >
                              {item.name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="shadow-xl text-xs rounded-lg p-2 max-w-xs">
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">{isOverride ? item.path : (item.versionName || item.versionId)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Sub-line: [version/size] · [Provider Logo] (only if not override) · [Type Icon with color] */}
                      <div className="flex items-center gap-1.5 text-[10px] leading-none text-muted-foreground mt-1 min-w-0 w-full overflow-hidden h-4">
                        <span className="truncate min-w-0 shrink leading-none">{isOverride ? t("editor.dock.localOverride") : (item.versionName || item.versionId)}</span>
                        
                        {!isOverride && (
                          <>
                            <span className="text-muted-foreground/30 select-none shrink-0 leading-none flex items-center">•</span>
                            <ProviderIcon provider={item.provider} size="sm" />
                          </>
                        )}

                        <span className="text-muted-foreground/30 select-none shrink-0 leading-none flex items-center">•</span>

                        {/* Type Icon with specific color */}
                        <ContentTypeIcon type={item.contentType} />

                        {/* Verified Check Icon with the exact same separator and style */}
                        {verifiedItems.includes(item.id) && (
                          <>
                            <span className="text-muted-foreground/30 select-none shrink-0 leading-none flex items-center">•</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center text-emerald-500 shrink-0 cursor-default">
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs font-medium">
                                <p>{t("editor.dock.verifiedBadge", { mcVersion: packSettings.mcVersion, loader: packSettings.loader })}</p>
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Unified Corporate Trash Action Button (Compact h-8 w-8) */}
                  {isExpanded && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      title={t("editor.dock.removeItem")}
                      className="flex opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-xl border border-border bg-muted text-muted-foreground hover:border-[#FE5000] hover:text-[#FE5000] hover:bg-transparent items-center justify-center shrink-0 ml-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredItems.length === 0 && isExpanded && (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 my-auto">
              <svg 
                className="w-10 h-10 mb-2.5 text-zinc-400 dark:text-zinc-600" 
                viewBox="0 0 190 200" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  clipRule="evenodd" 
                  d="M94.5358 0L189.072 46.7937V153.206L94.5358 200L0 153.206V46.7937L94.5358 0ZM17.1883 65.9994V142.508L85.9416 176.539V100.031L17.1883 65.9994ZM103.13 100.031V176.539L171.883 142.508V65.9994L146.101 78.7614V112.914L128.912 121.523V87.2697L103.13 100.031ZM161.078 52.1425L138.683 63.2268C138.193 62.8213 137.649 62.4645 137.055 62.1672L72.7811 29.974L94.5358 19.2057L161.078 52.1425ZM53.4502 39.5424L119.598 72.6741L94.5358 85.0795L27.9945 52.1425L53.4502 39.5424Z" 
                />
              </svg>
              <p className="text-muted-foreground text-xs font-medium">
                {installedContent.length === 0 
                  ? t("editor.dock.emptyTitle") 
                  : t("editor.dock.noMatchTitle")}
              </p>
              <p className="text-muted-foreground/60 text-[11px] mt-1 max-w-[200px] leading-relaxed">
                {installedContent.length === 0 
                  ? t("editor.dock.emptyDesc") 
                  : t("editor.dock.noMatchDesc")}
              </p>
            </div>
          )}
          </div>
        </ScrollArea>
      </TooltipProvider>

      <Separator className="bg-border" />

      {/* Export button */}
      <div className={`bg-background shrink-0 border-t border-border w-full sticky bottom-0 z-50 transition-all ${isExpanded ? "pl-4 pr-6 py-4" : "p-4 flex justify-center"}`}>
        <button 
          onClick={handleExportModpack}
          title={t("editor.dock.exportModpkg")}
          className={`h-12 flex items-center justify-center bg-[#FE5000] hover:bg-[#E04700] text-white font-semibold rounded-xl transition-all outline outline-2 outline-transparent hover:outline-[#FE5000] hover:outline-offset-[3px] active:scale-95 duration-200 overflow-hidden cursor-pointer ${isExpanded ? "w-full gap-2" : "w-12 shrink-0"}`}
        >
          <Download className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
                exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                className="whitespace-nowrap font-bold"
              >
                {t("editor.dock.exportModpkg")}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <ExportModpkgDialog
        isOpen={isExportDialogOpen}
        onClose={() => {
          setIsExportDialogOpen(false);
          setIsHovered(false);
        }}
      />

    </motion.aside>
  );
}
