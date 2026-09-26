import ModCard, { ModItemData, CardContentType, CardProviderType } from "./mod-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Hash, SearchX, Settings2, X, PlusCircle, Plus } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "@/hooks/use-debounce";
import { searchMods } from "@/lib/api/mods";
import { usePack } from "@/context/pack-context";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getCustomContentItems, getPackageCustomContentItems, getHiddenCustomItemIds } from "@/lib/storage/custom-content-storage";
import { AddCustomContentDialog } from "@/components/views/add-custom-content-dialog";
import { CustomContentItem } from "@/types";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export interface ModGridProps {
  contentType: string;
  provider: string;
  searchQuery: string;
  selectedCategories: string[];
  selectedEnvironments: string[];
  sortBy: string;
  setSortBy: (sort: string) => void;
  onClearFilters: () => void;
  onOpenSettings: () => void;
  onCategoryClick?: (category: string) => void;
}

const skeletonContainer = {
  hidden: { opacity: 1 },
  show: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.15 } }
};

const skeletonItem = {
  hidden: { opacity: 1 },
  show: { opacity: 1 }
};

const contentContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04
    }
  }
};

const contentItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } }
};

const ModCardSkeleton = () => (
  <motion.div variants={skeletonItem} className="group relative bg-card dark:bg-[#1E1E1E] border border-border dark:border-transparent rounded-2xl p-5 flex flex-col gap-4 overflow-hidden outline outline-3 outline-transparent h-full animate-pulse">
    <div className="flex items-start justify-between relative z-10">
      <div className="flex gap-4 items-center">
        <Skeleton className="w-14 h-14 rounded-xl bg-muted shrink-0" />
        <div className="flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-1.5 w-fit">
            <Skeleton className="h-[18px] w-[140px] bg-muted" />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 w-fit">
            <Skeleton className="h-[14px] w-[80px] bg-muted" />
          </div>
        </div>
      </div>
      <div className="flex items-center ml-2 shrink-0">
        <Skeleton className="w-[65px] h-[32px] rounded-full bg-muted" />
      </div>
    </div>
    <div className="mt-1 flex flex-col relative z-10 pt-[3px]">
      <Skeleton className="h-[14px] w-full bg-muted" />
      <Skeleton className="h-[14px] w-5/6 bg-muted mt-[8px]" />
    </div>
    <div className="flex items-end justify-between mt-auto pt-2 relative z-10 gap-2">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-[20px] w-[75px] bg-muted rounded-md" />
        <Skeleton className="h-[20px] w-[50px] bg-muted rounded-md" />
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Skeleton className="w-6 h-6 rounded-md bg-muted" />
        <Skeleton className="w-6 h-6 rounded-md bg-muted" />
      </div>
    </div>
  </motion.div>
);

export default function ModGrid({ 
  contentType = "mods",
  provider = "all",
  searchQuery = "",
  selectedCategories = [],
  selectedEnvironments = [],
  sortBy = "relevance",
  setSortBy,
  onClearFilters,
  onOpenSettings,
  onCategoryClick
}: ModGridProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mods, setMods] = useState<ModItemData[]>([]);
  const [limit, setLimit] = useState<string>("20");
  const [page, setPage] = useState<number>(1);

  const { packSettings, installedContent } = usePack();
  const { mcVersion, loader } = packSettings;

  const debouncedQuery = useDebounce(searchQuery, 400);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [customStorageVersion, setCustomStorageVersion] = useState<number>(0);
  const [editingCustomItem, setEditingCustomItem] = useState<CustomContentItem | null>(null);
  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleCustomStorageChanged = () => {
      setCustomStorageVersion(v => v + 1);
    };
    window.addEventListener("modpkg-custom-storage-changed", handleCustomStorageChanged);
    return () => window.removeEventListener("modpkg-custom-storage-changed", handleCustomStorageChanged);
  }, []);

  const handlePageChange = (newPage: number | ((p: number) => number)) => {
    setPage(newPage);
    window.scrollTo({ top: 0 });
  };

  const filterKey = `${debouncedQuery}|${provider}|${contentType}|${selectedCategories.join(",")}|${selectedEnvironments.join(",")}|${sortBy}|${limit}|${mcVersion}|${loader}|${customStorageVersion}`;
  const prevFilterKeyRef = useRef<string>(filterKey);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    let targetPage = page;
    if (prevFilterKeyRef.current !== filterKey) {
      prevFilterKeyRef.current = filterKey;
      if (page !== 1) {
        setPage(1);
        targetPage = 1;
      }
    }

    // Helper for loader & MC version package compatibility & pack-level blacklisting
    const hiddenIds = getHiddenCustomItemIds(packSettings.id);
    const isCustomContentCompatible = (item: any) => {
      if (item.id && hiddenIds.includes(item.id)) return false;
      const isMcCompat = !item.mcVersion || item.mcVersion === "Any" || item.mcVersion.split(",").map((v: string) => v.trim()).includes(mcVersion);
      const isLoaderCompat = !item.loader || item.loader === "Any" || item.loader.split(",").map((l: string) => l.trim().toLowerCase()).includes(loader.toLowerCase());
      return isMcCompat && isLoaderCompat;
    };

    // Custom Provider logic: load custom resources from local storage & format as Cards!
    if (provider === "custom") {
      const globalCustomItems = getCustomContentItems();
      const packageCustomItems = getPackageCustomContentItems(packSettings.id);

      // Combine package-exclusive custom items and global custom items
      const allCustomItems = [...packageCustomItems];
      globalCustomItems.forEach(gItem => {
        if (!allCustomItems.some(p => p.id === gItem.id)) {
          allCustomItems.push(gItem);
        }
      });

      const filteredCustom = allCustomItems.filter((item) => {
        // Must match active package's MC version and loader
        if (!isCustomContentCompatible(item)) return false;

        // Content type filter
        if (contentType === "mods" && item.contentType !== "mod") return false;
        if (contentType === "textures" && item.contentType !== "resourcepack") return false;
        if (contentType === "shaders" && item.contentType !== "shader") return false;
        if (contentType === "datapacks" && item.contentType !== "datapack") return false;
        if (contentType === "worlds" && item.contentType !== "world") return false;
        if (contentType === "overrides" && item.contentType !== "override") return false;

        // Search query
        if (debouncedQuery.trim()) {
          const q = debouncedQuery.toLowerCase();
          return (
            item.name.toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q) ||
            (item.author && item.author.toLowerCase().includes(q)) ||
            item.downloadUrl.toLowerCase().includes(q) ||
            (item.targetPath && item.targetPath.toLowerCase().includes(q))
          );
        }
        return true;
      });

      const formattedCards: ModItemData[] = filteredCustom.map((item) => ({
        id: item.id,
        name: item.name,
        author: item.author || "Custom Provider",
        iconUrl: "",
        description: item.downloadUrl,
        categories: [],
        provider: "custom" as CardProviderType,
        type: item.contentType as CardContentType,
        websiteUrl: item.downloadUrl,
        mcVersion: item.mcVersion,
        loader: item.loader,
        targetPath: item.targetPath,
        storageLocation: item.storageLocation,
        customItem: item,
      }));

      if (mounted) {
        setMods(formattedCards);
        setIsLoading(false);
      }
      return;
    }

    // Standard API search logic (and search custom items when provider === 'all')
    const offset = (targetPage - 1) * parseInt(limit, 10);
    searchMods(
      debouncedQuery,
      provider,
      contentType,
      selectedCategories,
      selectedEnvironments,
      sortBy,
      parseInt(limit, 10),
      offset,
      mcVersion,
      loader
    ).then((data) => {
      if (mounted) {
        if (provider === "all" || !provider) {
          // Find matching local custom items ONLY when there is an active search query and they are compatible
          if (debouncedQuery.trim()) {
            const globalCustomItems = getCustomContentItems();
            const packageCustomItems = getPackageCustomContentItems(packSettings.id);
            const allCustomItems = [...packageCustomItems];
            globalCustomItems.forEach(gItem => {
              if (!allCustomItems.some(p => p.id === gItem.id)) {
                allCustomItems.push(gItem);
              }
            });

            const q = debouncedQuery.toLowerCase();
            const matchingCustom = allCustomItems
              .filter((item) => {
                if (!isCustomContentCompatible(item)) return false;

                if (contentType === "mods" && item.contentType !== "mod") return false;
                if (contentType === "textures" && item.contentType !== "resourcepack") return false;
                if (contentType === "shaders" && item.contentType !== "shader") return false;
                if (contentType === "datapacks" && item.contentType !== "datapack") return false;
                if (contentType === "worlds" && item.contentType !== "world") return false;
                if (contentType === "overrides" && item.contentType !== "override") return false;

                return (
                  item.name.toLowerCase().includes(q) ||
                  item.id.toLowerCase().includes(q) ||
                  (item.author && item.author.toLowerCase().includes(q)) ||
                  item.downloadUrl.toLowerCase().includes(q) ||
                  (item.targetPath && item.targetPath.toLowerCase().includes(q))
                );
              })
              .map((item) => ({
                id: item.id,
                name: item.name,
                author: item.author || "Custom Provider",
                iconUrl: "",
                description: item.downloadUrl,
                categories: [],
                provider: "custom" as CardProviderType,
                type: item.contentType as CardContentType,
                websiteUrl: item.downloadUrl,
                mcVersion: item.mcVersion,
                loader: item.loader,
                targetPath: item.targetPath,
                storageLocation: item.storageLocation,
                customItem: item,
              }));

            setMods([...matchingCustom, ...data]);
          } else {
            setMods(data);
          }
        } else {
          setMods(data);
        }
        setIsLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [debouncedQuery, provider, contentType, selectedCategories, selectedEnvironments, sortBy, limit, page, mcVersion, loader, customStorageVersion, filterKey]);

  const contentTypeLabels: Record<string, string> = {
    mods: t("myResources.types.mods"),
    textures: t("myResources.types.textures"),
    datapacks: t("myResources.types.datapacks"),
    shaders: t("myResources.types.shaders"),
    worlds: t("myResources.types.worlds"),
    overrides: t("editor.sidebar.overridesTab")
  };

  const currentLabel = contentTypeLabels[contentType] || t("myResources.types.mods");

  const isMax50 = provider === "all" || provider === "curseforge";

  useEffect(() => {
    if (isMax50 && parseInt(limit, 10) > 50) {
      setLimit("50");
    }
  }, [provider, isMax50, limit]);

  return (
    <div ref={scrollRef} className="flex-1 min-w-0 flex flex-col">
      <div className="flex flex-col px-6 pt-3 pb-6 flex-1">
      
      {/* Header - Uniform across all providers */}
      <div className="flex items-center justify-between mb-4 mt-0 z-10 bg-background flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{t("editor.grid.browseTitle", { type: currentLabel })}</h2>
        </div>
        
        {/* Controls - Uniform Amount & Sort by */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              {t("editor.grid.amount", { count: isLoading ? 0 : mods.length })}
            </span>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="w-[80px] bg-muted/70 border border-border text-foreground focus:ring-0 focus:border-[#FE5000] h-10 rounded-xl px-3 text-sm font-medium">
                <SelectValue placeholder="20" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border text-popover-foreground rounded-xl shadow-xl">
                <SelectItem value="5" className="focus:bg-muted focus:text-[#FE5000] text-sm">5</SelectItem>
                <SelectItem value="10" className="focus:bg-muted focus:text-[#FE5000] text-sm">10</SelectItem>
                <SelectItem value="15" className="focus:bg-muted focus:text-[#FE5000] text-sm">15</SelectItem>
                <SelectItem value="20" className="focus:bg-muted focus:text-[#FE5000] text-sm">20</SelectItem>
                <SelectItem value="50" className="focus:bg-muted focus:text-[#FE5000] text-sm">50</SelectItem>
                {!isMax50 && (
                  <SelectItem value="100" className="focus:bg-muted focus:text-[#FE5000] text-sm">100</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-6 bg-border" />

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              {t("editor.grid.sortBy")}
            </span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px] bg-muted/70 border border-border text-foreground focus:ring-0 focus:border-[#FE5000] h-10 rounded-xl px-3 text-sm font-medium">
                <SelectValue placeholder="Sort option" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border text-popover-foreground rounded-xl shadow-xl">
                <SelectItem value="relevance" className="focus:bg-muted focus:text-[#FE5000] text-sm">{t("editor.grid.relevance")}</SelectItem>
                <SelectItem value="downloads" className="focus:bg-muted focus:text-[#FE5000] text-sm">{t("editor.grid.downloads")}</SelectItem>
                <SelectItem value="updated" className="focus:bg-muted focus:text-[#FE5000] text-sm">{t("editor.grid.updated")}</SelectItem>
                <SelectItem value="newest" className="focus:bg-muted focus:text-[#FE5000] text-sm">{t("editor.grid.newest")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid or Centered Empty State */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div 
            key="skeletons"
            variants={skeletonContainer}
            initial="hidden"
            animate="show"
            exit="exit"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6"
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <ModCardSkeleton key={i} />
            ))}
          </motion.div>
        ) : mods.length > 0 ? (
          <motion.div 
            key={`content-${contentType}-${provider}`}
            variants={contentContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6"
          >
            {mods.map(mod => (
              <motion.div key={`${mod.provider}-${mod.id}`} variants={contentItem}>
                <ModCard 
                  mod={mod} 
                  onCategoryClick={onCategoryClick} 
                  onEditCustomItem={(customItem) => setEditingCustomItem(customItem)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key={`empty-${contentType}-${provider}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col items-center justify-center w-full min-h-[460px] my-auto py-12 text-center"
          >
            <Empty className="w-full max-w-xl mx-auto flex flex-col items-center justify-center border-0 p-0">
              <EmptyHeader className="max-w-md flex flex-col items-center text-center">
                <EmptyMedia 
                  variant="icon" 
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                    provider === "custom" ? "bg-blue-500/10 text-blue-400" : "bg-[#FE5000]/10 text-[#FE5000]"
                  }`}
                >
                  {provider === "custom" ? (
                    <PlusCircle className="w-7 h-7" />
                  ) : (
                    <SearchX className="w-7 h-7" />
                  )}
                </EmptyMedia>
                <EmptyTitle className="text-foreground text-xl font-bold">
                  {provider === "custom" ? t("editor.grid.noCustomTitle") : t("editor.grid.noResultsTitle")}
                </EmptyTitle>
                <EmptyDescription className="text-muted-foreground max-w-md mx-auto text-sm text-center">
                  {provider === "custom"
                    ? t("editor.grid.noCustomDesc", { type: currentLabel.toLowerCase() })
                    : t("editor.grid.noResultsDesc", { type: currentLabel.toLowerCase() })}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="max-w-none flex flex-row items-center justify-center gap-3 mt-4">
                {provider === "custom" ? (
                  <>
                    <Button 
                      onClick={() => setIsAddCustomModalOpen(true)}
                      className="bg-blue-500 hover:bg-blue-400 text-white rounded-xl h-10 px-5 text-sm font-semibold gap-2 border-0 outline outline-2 outline-transparent hover:outline-blue-500/50 hover:outline-offset-2 active:scale-95 transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      {t("editor.grid.addCustomContent")}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-10 px-4 text-sm font-medium transition-all cursor-pointer"
                      onClick={onOpenSettings}
                    >
                      <Settings2 className="w-4 h-4 mr-2" />
                      {t("editor.grid.packageSettings")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="ghost" 
                      className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-10 px-4 text-sm font-medium transition-all cursor-pointer"
                      onClick={onOpenSettings}
                    >
                      <Settings2 className="w-4 h-4 mr-2" />
                      {t("editor.grid.packageSettings")}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-10 px-4 text-sm font-medium transition-all cursor-pointer"
                      onClick={onClearFilters}
                    >
                      <X className="w-4 h-4 mr-2" />
                      {t("editor.grid.clearFilters")}
                    </Button>
                  </>
                )}
              </EmptyContent>
            </Empty>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Pagination Controls */}
      {mods.length > 0 && !isLoading && provider !== "custom" && (
        <div className="pt-4 pb-8 relative z-10">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); if (page > 1) handlePageChange(p => p - 1); }}
                  className={page === 1 ? "pointer-events-none opacity-50 text-muted-foreground" : "cursor-pointer text-foreground hover:bg-muted hover:text-foreground"}
                />
              </PaginationItem>

              {page > 2 && (
                <PaginationItem>
                  <PaginationLink 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); handlePageChange(1); }}
                    className="text-foreground hover:bg-muted hover:text-foreground"
                  >
                    1
                  </PaginationLink>
                </PaginationItem>
              )}

              {page > 3 && (
                <PaginationItem>
                  <PaginationEllipsis className="text-muted-foreground" />
                </PaginationItem>
              )}

              {page > 1 && (
                <PaginationItem>
                  <PaginationLink 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); handlePageChange(p => p - 1); }}
                    className="text-foreground hover:bg-muted hover:text-foreground"
                  >
                    {page - 1}
                  </PaginationLink>
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationLink 
                  href="#" 
                  isActive 
                  className="bg-muted text-[#FE5000] hover:bg-muted hover:text-[#FE5000] border border-border/50 font-bold cursor-default"
                  onClick={(e) => e.preventDefault()}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>

              {mods.length >= parseInt(limit, 10) && (
                <PaginationItem>
                  <PaginationLink 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); handlePageChange(p => p + 1); }}
                    className="text-foreground hover:bg-muted hover:text-foreground"
                  >
                    {page + 1}
                  </PaginationLink>
                </PaginationItem>
              )}

              {mods.length >= parseInt(limit, 10) && (
                <PaginationItem>
                  <PaginationNext 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); handlePageChange(p => p + 1); }}
                    className="cursor-pointer text-foreground hover:bg-muted hover:text-foreground"
                  />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {editingCustomItem && (
        <AddCustomContentDialog
          context="editor"
          isOpen={!!editingCustomItem}
          onClose={() => setEditingCustomItem(null)}
          editItem={editingCustomItem}
          defaultAddToPackage={installedContent.some(i => i.id === editingCustomItem.id)}
          defaultSaveAsCommon={getCustomContentItems().some(i => i.id === editingCustomItem.id)}
        />
      )}

      <AddCustomContentDialog
        context="editor"
        isOpen={isAddCustomModalOpen}
        onClose={() => setIsAddCustomModalOpen(false)}
        defaultAddToPackage={true}
        defaultSaveAsCommon={true}
      />

      </div>
    </div>
  );
}
