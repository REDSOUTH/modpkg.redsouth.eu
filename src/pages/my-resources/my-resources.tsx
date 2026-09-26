import { useState, useEffect } from "react";
import { CustomContentItem } from "@/types";
import { getCustomContentItems, deleteCustomContentItem } from "@/lib/storage/custom-content-storage";
import { CustomContentTable } from "@/pages/custom-content/components/custom-content-table";
import { AddCustomContentDialog } from "@/components/views/add-custom-content-dialog";
import { ConfigFilesTab } from "./components/config-files-tab";
import { MyResourcesSidebar } from "./components/my-resources-sidebar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Plus, PlusCircle, FileSliders } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

type ActiveTab = "custom-content" | "custom-files";

export default function MyResourcesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>("custom-content");

  const [items, setItems] = useState<CustomContentItem[]>(() => getCustomContentItems());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStorage, setSelectedStorage] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedLoader, setSelectedLoader] = useState("all");
  const [selectedMcVersion, setSelectedMcVersion] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomContentItem | null>(null);

  useEffect(() => {
    document.title = "MODPKG — My Resources";
  }, []);

  const handleDeleteItem = (id: string) => {
    deleteCustomContentItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };
  const handleAddedItem = (item: CustomContentItem) => setItems((prev) => [item, ...prev]);
  const handleUpdatedItem = (item: CustomContentItem) =>
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  const handleStartEdit = (item: CustomContentItem) => {
    setEditingItem(item);
    setIsAddDialogOpen(true);
  };
  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingItem(null);
  };

  const counts = {
    all: items.length,
    mods: items.filter((i) => i.contentType === "mod").length,
    textures: items.filter((i) => i.contentType === "resourcepack").length,
    shaders: items.filter((i) => i.contentType === "shader").length,
    datapacks: items.filter((i) => i.contentType === "datapack").length,
    worlds: items.filter((i) => i.contentType === "world").length,
  };

  const filteredItems = items.filter((item) => {
    if (selectedStorage === "local" && item.storageLocation !== "local_browser") return false;
    if (selectedStorage === "cloud" && item.storageLocation !== "account_cloud") return false;
    if (selectedType === "mods" && item.contentType !== "mod") return false;
    if (selectedType === "textures" && item.contentType !== "resourcepack") return false;
    if (selectedType === "shaders" && item.contentType !== "shader") return false;
    if (selectedType === "datapacks" && item.contentType !== "datapack") return false;
    if (selectedType === "worlds" && item.contentType !== "world") return false;
    if (selectedLoader !== "all") {
      if (!item.loader || (item.loader !== "Any" && !item.loader.toLowerCase().includes(selectedLoader.toLowerCase()))) return false;
    }
    if (selectedMcVersion !== "all") {
      if (!item.mcVersion || (item.mcVersion !== "Any" && !item.mcVersion.includes(selectedMcVersion))) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.author && item.author.toLowerCase().includes(q)) ||
        item.downloadUrl.toLowerCase().includes(q) ||
        (item.targetPath && item.targetPath.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSelectedType("all");
    setSelectedStorage("all");
    setSearchQuery("");
    setSelectedLoader("all");
    setSelectedMcVersion("all");
  };

  return (
    <>
      <div className="flex w-full max-w-[1920px] mx-auto bg-background min-h-[calc(100vh-65px)]">

        {/* ── Single unified sidebar ── */}
        <MyResourcesSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          items={items}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedStorage={selectedStorage}
          setSelectedStorage={setSelectedStorage}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          selectedLoader={selectedLoader}
          setSelectedLoader={setSelectedLoader}
          selectedMcVersion={selectedMcVersion}
          setSelectedMcVersion={setSelectedMcVersion}
          counts={counts}
          onAddResource={() => { setEditingItem(null); setIsAddDialogOpen(true); }}
          onAddConfigFile={() => window.dispatchEvent(new CustomEvent("open-add-custom-file"))}
        />

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">

            {activeTab === "custom-content" && (
              <motion.div
                key="custom-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex flex-col px-6 pt-5 pb-6"
              >
                <div className="mb-4">
                  <h2 className="text-3xl font-bold text-foreground">{t("myResources.tabs.customContent")}</h2>
                  <p className="text-xs text-blue-400 font-semibold mt-1">
                    {filteredItems.length === 1
                      ? t("myResources.showing_one", { count: 1 })
                      : t("myResources.showing_other", { count: filteredItems.length })}
                  </p>
                </div>

                <AnimatePresence initial={false}>
                  {filteredItems.length > 0 ? (
                    <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="w-full pb-6">
                      <CustomContentTable items={filteredItems} onDelete={handleDeleteItem} onEdit={handleStartEdit} />
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="py-8 flex flex-col items-center justify-center">
                      <Empty className="w-full max-w-xl mx-auto py-6">
                        <EmptyHeader>
                          <EmptyMedia variant="icon" className="bg-blue-500/10 text-blue-400">
                            <PlusCircle className="w-8 h-8" />
                          </EmptyMedia>
                          <EmptyTitle className="text-foreground text-xl font-bold">{t("myResources.emptyContent.title")}</EmptyTitle>
                          <EmptyDescription className="text-muted-foreground max-w-md mx-auto text-sm">
                            {items.length === 0
                              ? t("myResources.emptyContent.descEmpty")
                              : t("myResources.emptyContent.descNoMatch")}
                          </EmptyDescription>
                        </EmptyHeader>
                        <Button
                          onClick={() => { setEditingItem(null); setIsAddDialogOpen(true); }}
                          className="bg-blue-500 hover:bg-blue-400 text-white rounded-xl h-10 px-5 text-sm font-semibold gap-2 mt-4 active:scale-95 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          {t("myResources.emptyContent.btn")}
                        </Button>
                      </Empty>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === "custom-files" && (
              <motion.div
                key="custom-files"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1"
              >
                <ConfigFilesTab
                  searchQuery={searchQuery}
                  selectedStorage={selectedStorage}
                  selectedType={selectedType}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      <AddCustomContentDialog
        isOpen={isAddDialogOpen}
        onClose={handleCloseDialog}
        onAdded={handleAddedItem}
        onUpdated={handleUpdatedItem}
        editItem={editingItem}
        context="standalone"
      />
    </>
  );
}
