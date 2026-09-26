import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import EditorSidebar from "./components/editor-sidebar";
import SelectedDock from "./components/selected-dock";
import ModGrid from "./components/mod-grid";
import { CustomFilesWorkspace } from "./components/custom-files-workspace";
import EditorTopbar from "./components/editor-topbar";
import PackSettingsModal from "./components/pack-settings-modal";
import { AddConfigFileDialog } from "@/components/views/add-config-file-dialog";
import { usePack } from "@/context/pack-context";
import { FocusField } from "@/types";

export default function EditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCreatePackModalOpen, setIsCreatePackModalOpen, packagesList, customFiles, importPack } = usePack();
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [focusField, setFocusField] = useState<FocusField>(null);
  const [contentType, setContentType] = useState<string>("mods");
  
  // View mode: "browse" (Browse & Add Content) or "overrides" (Overrides & Custom Files)
  const [activeView, setActiveView] = useState<"browse" | "overrides">("browse");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isAddFileDialogOpen, setIsAddFileDialogOpen] = useState<boolean>(false);

  // Lifted state for browse mode
  const [provider, setProvider] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>("relevance");

  const [isSettingsCreateMode, setIsSettingsCreateMode] = useState<boolean>(false);

  const handleOpenSettings = (field: FocusField = null, isCreate = false) => {
    setFocusField(field);
    setIsSettingsCreateMode(isCreate);
    setIsSettingsOpen(true);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedEnvironments([]);
  };

  useEffect(() => {
    document.title = "MODPKG — Editor";
  }, []);

  // When no packages exist, ensure create modal is open on top of editor
  useEffect(() => {
    if (packagesList.length === 0) {
      setIsCreatePackModalOpen(true);
    }
  }, [packagesList.length, setIsCreatePackModalOpen]);

  // Handle package imported from JSON file if passed via navigation state (fallback)
  const hasImportedRef = useRef<boolean>(false);
  useEffect(() => {
    const parsed = (location.state as any)?.parsedJson;
    if (parsed && !hasImportedRef.current) {
      hasImportedRef.current = true;
      try {
        importPack(parsed);
      } catch (err) {
        console.error("Failed to import pack from navigation state:", err);
      }
      navigate("/editor", { replace: true, state: {} });
    }
  }, [location.state, importPack, navigate]);

  const handleDockItemClick = (item: any) => {
    if (!item?.id) return;
    setActiveView("browse");
    setSearchQuery(item.id);
    const typeMap: Record<string, string> = {
      mod: "mods",
      mods: "mods",
      resourcepack: "textures",
      resourcepacks: "textures",
      texturepack: "textures",
      textures: "textures",
      shader: "shaders",
      shaders: "shaders",
      datapack: "datapacks",
      datapacks: "datapacks",
      world: "worlds",
      worlds: "worlds",
    };
    if (item.contentType && typeMap[item.contentType]) {
      setContentType(typeMap[item.contentType]);
    }
    if (item.provider && provider !== "all" && provider !== item.provider) {
      setProvider(item.provider);
    }
  };

  const isModalOpen = isSettingsOpen || isCreatePackModalOpen;
  const activeCreateMode = isSettingsCreateMode || isCreatePackModalOpen;

  return (
    <>
      {/* Fixed topbar always at viewport top */}
      <EditorTopbar onOpenSettings={handleOpenSettings} />

      <div className="flex flex-col w-full max-w-[1920px] mx-auto bg-background min-h-[calc(100vh-121px)]">
        
        <div className="flex flex-1 min-w-0 relative">
          <EditorSidebar 
            activeView={activeView}
            setActiveView={setActiveView}
            selectedFileId={selectedFileId}
            onSelectFile={setSelectedFileId}
            contentType={contentType} 
            setContentType={setContentType} 
            provider={provider}
            setProvider={setProvider}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            selectedEnvironments={selectedEnvironments}
            setSelectedEnvironments={setSelectedEnvironments}
          />

          {activeView === "browse" ? (
            <ModGrid 
              contentType={contentType} 
              provider={provider}
              searchQuery={searchQuery}
              selectedCategories={selectedCategories}
              selectedEnvironments={selectedEnvironments}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onClearFilters={handleClearFilters}
              onOpenSettings={() => handleOpenSettings(null)}
              onCategoryClick={(cat) => setSelectedCategories(prev => prev.includes(cat) ? prev : [...prev, cat])}
            />
          ) : (
            <CustomFilesWorkspace
              selectedFileId={selectedFileId}
              onSelectFile={setSelectedFileId}
              onOpenAddDialog={() => setIsAddFileDialogOpen(true)}
            />
          )}

          <SelectedDock onItemClick={handleDockItemClick} />
        </div>

        <PackSettingsModal 
          isOpen={isModalOpen} 
          isCreateMode={activeCreateMode}
          onClose={() => { 
            setIsSettingsOpen(false); 
            setIsCreatePackModalOpen(false);
            setIsSettingsCreateMode(false);
            setFocusField(null); 
          }} 
          onCancel={() => {
            setIsSettingsOpen(false); 
            setIsCreatePackModalOpen(false);
            setIsSettingsCreateMode(false);
            setFocusField(null); 
            if (packagesList.length === 0) {
              navigate("/");
            }
          }} 
          focusField={focusField}
        />

        {/* Modal for adding a new Custom File in Editor */}
        <AddConfigFileDialog
          isOpen={isAddFileDialogOpen}
          onClose={() => setIsAddFileDialogOpen(false)}
          context="editor"
          defaultAddToPackage={true}
          defaultSaveAsCommon={true}
          onAdded={(item) => {
            setSelectedFileId(item.id);
            setIsAddFileDialogOpen(false);
          }}
        />
      </div>
    </>
  );
}
