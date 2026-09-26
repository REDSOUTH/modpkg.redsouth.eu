import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CustomFileItem } from "@/types";
import { getCustomFileItems, deleteCustomFileItem } from "@/lib/storage/config-files-storage";
import { ConfigFilesTable } from "./config-files-table";
import { AddConfigFileDialog } from "@/components/views/add-config-file-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Plus, FileSliders } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface ConfigFilesTabProps {
  searchQuery?: string;
  selectedStorage?: string;
  selectedType?: string;
}

export function ConfigFilesTab({
  searchQuery = "",
  selectedStorage = "all",
  selectedType = "all",
}: ConfigFilesTabProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<CustomFileItem[]>(() => getCustomFileItems());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomFileItem | null>(null);

  const openAddDialog = useCallback(() => {
    setEditingItem(null);
    setIsDialogOpen(true);
  }, []);

  // Listen for the topbar button event
  useEffect(() => {
    window.addEventListener("open-add-custom-file", openAddDialog);
    window.addEventListener("open-add-config-file", openAddDialog);
    return () => {
      window.removeEventListener("open-add-custom-file", openAddDialog);
      window.removeEventListener("open-add-config-file", openAddDialog);
    };
  }, [openAddDialog]);

  const handleDelete = (id: string) => {
    deleteCustomFileItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAdded = (item: CustomFileItem) => setItems((prev) => [item, ...prev]);
  const handleUpdated = (item: CustomFileItem) =>
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));

  const handleEdit = (item: CustomFileItem) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  const filteredItems = items.filter((item) => {
    if (selectedStorage === "local" && item.storageLocation !== "local_browser") return false;
    if (selectedStorage === "cloud" && item.storageLocation !== "account_cloud") return false;
    if (selectedType !== "all" && item.type !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.targetPath.toLowerCase().includes(q) ||
        (item.sourceUrl && item.sourceUrl.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <>
      <div className="flex flex-col px-6 pt-5 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">{t("myResources.tabs.customFiles")}</h2>
            <p className="text-xs text-amber-400 font-semibold mt-1">
              {t("myResources.showing", { count: filteredItems.length })}
            </p>
          </div>
        </div>

        {/* Table / Empty state */}
        <AnimatePresence initial={false}>
          {filteredItems.length > 0 ? (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="w-full pb-6"
            >
              <ConfigFilesTable items={filteredItems} onDelete={handleDelete} onEdit={handleEdit} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="col-span-full py-8 flex flex-col items-center justify-center"
            >
              <Empty className="w-full max-w-xl mx-auto py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-amber-400/10 text-amber-400">
                    <FileSliders className="w-8 h-8" />
                  </EmptyMedia>
                  <EmptyTitle className="text-foreground text-xl font-bold">{t("myResources.emptyFiles.title")}</EmptyTitle>
                  <EmptyDescription className="text-muted-foreground max-w-md mx-auto text-sm">
                    {t("myResources.emptyFiles.desc")}
                  </EmptyDescription>
                </EmptyHeader>
                <Button
                  onClick={() => { setEditingItem(null); setIsDialogOpen(true); }}
                  className="bg-amber-400 hover:bg-amber-300 text-black rounded-xl h-10 px-5 text-sm font-semibold transition-all gap-2 mt-4 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  {t("myResources.emptyFiles.btn")}
                </Button>
              </Empty>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AddConfigFileDialog
        isOpen={isDialogOpen}
        onClose={handleClose}
        onAdded={handleAdded}
        onUpdated={handleUpdated}
        editItem={editingItem}
        context="standalone"
      />
    </>
  );
}
