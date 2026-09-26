import { useState, useEffect } from "react";
import { usePack } from "@/context/pack-context";
import { PackSettings } from "@/types";
import { LibrarySidebar } from "./components/library-sidebar";
import { ModpkgCard } from "./components/modpkg-card";
import PackSettingsModal from "@/pages/editor/components/pack-settings-modal";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Package, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

export default function LibraryPage() {
  const { t } = useTranslation();
  const { packagesList, activePackId, switchPack } = usePack();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStorage, setSelectedStorage] = useState("all");
  const [selectedLoader, setSelectedLoader] = useState("all");
  const [selectedMcVersion, setSelectedMcVersion] = useState("all");

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [editingPack, setEditingPack] = useState<PackSettings | null>(null);

  useEffect(() => {
    document.title = "MODPKG — Librería de MODPKGs";
  }, []);

  const handleOpenSettings = (pack: PackSettings) => {
    setEditingPack(pack);
    setIsCreateMode(false);
    setIsSettingsModalOpen(true);
  };

  const handleCreatePack = () => {
    setEditingPack(null);
    setIsCreateMode(true);
    setIsSettingsModalOpen(true);
  };

  // Filter packages based on sidebar criteria
  const filteredPackages = packagesList.filter((pkg) => {
    // Storage filter: currently all packages are stored locally in browser storage
    if (selectedStorage === "cloud") {
      return false; // No cloud packages yet
    }

    // Loader filter
    if (selectedLoader !== "all") {
      if (!pkg.loader || pkg.loader.toLowerCase() !== selectedLoader.toLowerCase()) {
        return false;
      }
    }

    // Minecraft version filter
    if (selectedMcVersion !== "all") {
      if (!pkg.mcVersion || pkg.mcVersion !== selectedMcVersion) {
        return false;
      }
    }

    // Search query filter (name, id, description)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = pkg.name?.toLowerCase().includes(q);
      const matchId = pkg.id?.toLowerCase().includes(q);
      const matchDesc = pkg.description?.toLowerCase().includes(q);
      return Boolean(matchName || matchId || matchDesc);
    }

    return true;
  });

  return (
    <>
      <div className="flex w-full max-w-[1920px] mx-auto bg-background min-h-[calc(100vh-65px)]">
        {/* ── Sidebar ── */}
        <LibrarySidebar
          packages={packagesList}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedStorage={selectedStorage}
          setSelectedStorage={setSelectedStorage}
          selectedLoader={selectedLoader}
          setSelectedLoader={setSelectedLoader}
          selectedMcVersion={selectedMcVersion}
          setSelectedMcVersion={setSelectedMcVersion}
          onCreatePack={handleCreatePack}
        />

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col px-6 pt-5 pb-6">
            {/* Title & Subtitle */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-foreground">{t("library.title")}</h2>
              <p className="text-xs text-[#FE5000] font-semibold mt-1">
                {filteredPackages.length === 1
                  ? t("library.showing_one", { count: 1 })
                  : t("library.showing_other", { count: filteredPackages.length })}
              </p>
            </div>

            {/* Cards Grid or Empty State */}
            <AnimatePresence initial={false}>
              {filteredPackages.length > 0 ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8"
                >
                  {filteredPackages.map((pkg) => (
                    <ModpkgCard
                      key={pkg.id}
                      pack={pkg}
                      isActive={pkg.id === activePackId}
                      onOpenSettings={handleOpenSettings}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="py-16 flex flex-col items-center justify-center"
                >
                  <Empty className="w-full max-w-xl mx-auto py-8">
                    <EmptyHeader>
                      <EmptyMedia variant="icon" className="bg-[#FE5000]/10 text-[#FE5000]">
                        <Package className="w-8 h-8" />
                      </EmptyMedia>
                      <EmptyTitle className="text-foreground text-xl font-bold">
                        {packagesList.length === 0 ? t("library.empty.noPacksTitle") : t("library.empty.noMatchTitle")}
                      </EmptyTitle>
                      <EmptyDescription className="text-muted-foreground max-w-md mx-auto text-sm mt-1">
                        {packagesList.length === 0
                          ? t("library.empty.noPacksDesc")
                          : t("library.empty.noMatchDesc")}
                      </EmptyDescription>
                    </EmptyHeader>
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={handleCreatePack}
                        className="bg-[#FE5000] hover:bg-[#e04700] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-md shadow-[#FE5000]/20 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t("library.createNew")}</span>
                      </button>
                    </div>
                  </Empty>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Settings / Create modal */}
      <PackSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => {
          setIsSettingsModalOpen(false);
          setEditingPack(null);
        }}
        isCreateMode={isCreateMode}
        pack={isCreateMode ? null : editingPack}
      />
    </>
  );
}
