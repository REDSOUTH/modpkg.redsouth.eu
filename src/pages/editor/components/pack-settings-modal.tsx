import { DeleteConfirmDialog } from "@/components/common/delete-confirm-dialog";
import { ActionButton } from "@/components/common/action-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Check, X, FilePlus, Copy, Trash2, Settings, Package } from "lucide-react";
import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { usePack } from "@/context/pack-context";
import { getPackData } from "@/lib/storage/package-storage";
import { PackSettingsModalProps, FieldLabelProps } from "@/types";

function FieldLabel({ children }: FieldLabelProps) {
  return <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</label>;
}

const sanitizeSlug = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "");
};

export default function PackSettingsModal({ 
  isOpen, 
  onClose, 
  onCancel,
  focusField, 
  isCreateMode: propIsCreateMode = false,
  pack,
}: PackSettingsModalProps) {
  const { t } = useTranslation();
  const { 
    packSettings, 
    packagesList, 
    createPack, 
    deletePack,
    updatePackSettings, 
    createNewVersion, 
    deleteVersion, 
    getMinecraftVersions, 
    getLoaders 
  } = usePack();
  const navigate = useNavigate();

  const isClosingRef = useRef<boolean>(false);

  const handleCloseModal = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    if (onCancel) {
      onCancel();
    } else {
      onClose();
      if (packagesList.length === 0) {
        navigate("/");
      }
    }
  };

  const nameInputRef = useRef<HTMLInputElement>(null);
  const versionTriggerRef = useRef<HTMLButtonElement>(null);
  const mcVersionTriggerRef = useRef<HTMLButtonElement>(null);
  const loaderTriggerRef = useRef<HTMLButtonElement>(null);

  const isFirstPack = packagesList.length === 0;
  const isCreateMode = propIsCreateMode || isFirstPack;

  const livePack = !isCreateMode && pack 
    ? (packagesList.find(p => p.id === pack.id) || pack)
    : packSettings;

  const [name, setName] = useState<string>("MODPKG");
  const [id, setId] = useState<string>("");
  const [isIdCustomized, setIsIdCustomized] = useState<boolean>(false);
  const [mcVersion, setMcVersion] = useState<string>("26.3");
  const [loader, setLoader] = useState<string>("fabric");
  const [currentVersion, setCurrentVersion] = useState<string>("v1.0.0");

  const [showAllMcVersions, setShowAllMcVersions] = useState<boolean>(false);
  const [showAllLoaders, setShowAllLoaders] = useState<boolean>(false);

  const [isCreatingVersion, setIsCreatingVersion] = useState<boolean>(false);
  const [newVersionName, setNewVersionName] = useState<string>("");
  const [copySourceVersion, setCopySourceVersion] = useState<string>("empty");

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<boolean>(false);
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null);
  const [isConfirmDeletePackOpen, setIsConfirmDeletePackOpen] = useState<boolean>(false);

  const mcVersionsList = getMinecraftVersions(showAllMcVersions);
  const loadersList = getLoaders(showAllLoaders);

  // Sync modal form with livePack or reset defaults for Create Mode
  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      if (isCreateMode) {
        const availableMc = getMinecraftVersions(false);
        const randomSuffix = Math.random().toString(36).substring(2, 7);
        setName("MODPKG");
        setId(`modpkg-${randomSuffix}`);
        setIsIdCustomized(false);
        setMcVersion(availableMc[0] || "26.3");
        setLoader("fabric");
        setCurrentVersion("v1.0.0");
        setIsCreatingVersion(false);
      } else {
        setName(livePack.name);
        setId(livePack.id);
        setIsIdCustomized(false);
        setMcVersion(livePack.mcVersion);
        setLoader(livePack.loader);
        setCurrentVersion(livePack.currentVersion);
        setIsCreatingVersion(false);
        setNewVersionName("");
        setCopySourceVersion("empty");
      }

      setTimeout(() => {
        if (focusField === "name" && nameInputRef.current) {
          nameInputRef.current.focus();
          nameInputRef.current.select();
        } else if (focusField === "version" && versionTriggerRef.current) {
          versionTriggerRef.current.focus();
          versionTriggerRef.current.click();
        } else if (focusField === "mcVersion" && mcVersionTriggerRef.current) {
          mcVersionTriggerRef.current.focus();
          mcVersionTriggerRef.current.click();
        } else if (focusField === "loader" && loaderTriggerRef.current) {
          loaderTriggerRef.current.focus();
          loaderTriggerRef.current.click();
        }
      }, 150);
    }
  }, [isOpen, focusField, isCreateMode, livePack.id]);

  const handleSave = () => {
    if (!name.trim()) return;
    const cleanId = id.trim() || livePack.id;
    if (isCreateMode) {
      createPack({
        id: cleanId,
        slug: cleanId,
        name: name.trim(),
        mcVersion,
        loader,
        version: currentVersion.trim() || "v1.0.0",
        description: "Mi modpack personalizado creado con MODPKG",
      });
    } else {
      updatePackSettings({
        name: name.trim() || livePack.name,
        id: cleanId,
        slug: cleanId,
        mcVersion,
        loader,
        currentVersion
      }, livePack.id);
    }
    onClose();
  };

  const handleVersionChange = (newVer: string) => {
    setCurrentVersion(newVer);
    if (!isCreateMode && livePack.id) {
      const packData = getPackData(livePack.id);
      if (packData?.releases?.[newVer]) {
        const rel = packData.releases[newVer];
        if (rel.minecraft) setMcVersion(rel.minecraft);
        if (rel.loader?.type) setLoader(rel.loader.type);
      }
    }
  };

  const handleConfirmNewVersion = () => {
    if (newVersionName.trim()) {
      createNewVersion(newVersionName, copySourceVersion, isCreateMode ? undefined : livePack.id);
      setCurrentVersion(newVersionName.trim());
    }
    setIsCreatingVersion(false);
    setNewVersionName("");
    setCopySourceVersion("empty");
  };

  const handlePromptDelete = (ver: string) => {
    setVersionToDelete(ver);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    if (versionToDelete) {
      const deleteIdx = livePack.versions.indexOf(versionToDelete);
      const remainingVersions = livePack.versions.filter(v => v !== versionToDelete);
      const targetVersion = deleteIdx > 0 
        ? livePack.versions[deleteIdx - 1] 
        : remainingVersions[0];

      deleteVersion(versionToDelete, isCreateMode ? undefined : livePack.id);

      if (targetVersion) {
        handleVersionChange(targetVersion);
      }
    }
    setIsConfirmDeleteOpen(false);
    setVersionToDelete(null);
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isIdCustomized) {
      const slug = sanitizeSlug(val);
      setId(slug || "modpkg");
    }
  };

  const handleIdChange = (e: ChangeEvent<HTMLInputElement>) => {
    const cleaned = sanitizeSlug(e.target.value);
    setId(cleaned);
    setIsIdCustomized(true);
  };

  return (
    <>
      <Dialog 
        open={isOpen} 
        onOpenChange={(open) => {
          if (!open) handleCloseModal();
        }}
      >
        <DialogContent 
          hideClose
          className="sm:max-w-xl bg-card border border-border p-0 gap-0 overflow-hidden shadow-2xl rounded-2xl"
        >
          <DialogHeader className="p-5 px-6 border-b border-border flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-4">
              {isCreateMode ? (
                <Package className="w-8 h-8 text-[#FE5000] shrink-0" />
              ) : (
                <Settings className="w-8 h-8 text-[#FE5000] shrink-0" />
              )}
              <div className="flex flex-col text-left justify-center">
                <DialogTitle className="text-foreground text-lg font-bold leading-tight">
                  {isCreateMode ? t("packSettings.createTitle") : t("packSettings.settingsTitle")}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isCreateMode ? t("packSettings.createSubtitle") : t("packSettings.settingsSubtitle")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseModal}
              title={t("common.close")}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogHeader>

          <div className="p-6 flex flex-col gap-5">
            {/* Name & ID */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <FieldLabel>{t("packSettings.nameLabel")}</FieldLabel>
                <Input 
                  ref={nameInputRef}
                  value={name}
                  onChange={handleNameChange}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  placeholder={t("packSettings.namePlaceholder")}
                  className="bg-muted/70 border-2 border-border text-foreground h-11 rounded-xl focus-visible:border-[#FE5000]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <FieldLabel>{t("packSettings.idLabel")}</FieldLabel>
                <Input 
                  value={id}
                  onChange={handleIdChange}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  placeholder={t("packSettings.idPlaceholder")}
                  className="bg-muted/70 border-2 border-border text-foreground font-mono text-xs h-11 rounded-xl focus-visible:border-[#FE5000]"
                />
              </div>
            </div>

            {/* Version */}
            <div className="flex flex-col gap-2">
              <FieldLabel>{t("packSettings.versionLabel")}</FieldLabel>
              {isCreatingVersion ? (
                <div className="flex flex-col gap-3 p-4 bg-muted/60 border border-border rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("packSettings.createNewVersion")}</span>
                    <button 
                      onClick={() => setIsCreatingVersion(false)}
                      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">{t("packSettings.versionTagLabel")}</label>
                    <Input 
                      autoFocus
                      value={newVersionName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const cleaned = e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9.-]/g, "");
                        setNewVersionName(cleaned);
                      }}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter" && newVersionName.trim()) {
                          e.preventDefault();
                          handleConfirmNewVersion();
                        }
                      }}
                      placeholder={t("packSettings.versionPlaceholder")}
                      className="bg-muted/70 border-2 border-border text-foreground h-10 rounded-xl focus-visible:border-[#FE5000]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">{t("packSettings.initialContentLabel")}</label>
                    <Select value={copySourceVersion} onValueChange={setCopySourceVersion}>
                      <SelectTrigger className="bg-muted/70 border-2 border-border text-foreground h-10 rounded-xl">
                        <SelectValue placeholder={t("packSettings.selectSource")} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-2 border-border text-popover-foreground rounded-xl">
                        <SelectItem value="empty" className="focus:bg-muted focus:text-[#FE5000]">
                          <div className="flex items-center gap-2">
                            <FilePlus className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{t("packSettings.emptyFreshStart")}</span>
                          </div>
                        </SelectItem>
                        {livePack.versions.map((ver) => (
                          <SelectItem key={ver} value={ver} className="focus:bg-muted focus:text-[#FE5000]">
                            <div className="flex items-center gap-2">
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{t("packSettings.copyFrom", { version: ver })}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleConfirmNewVersion}
                    disabled={!newVersionName.trim()}
                    className="w-full bg-[#FE5000] hover:bg-[#E04700] text-white rounded-xl h-10 font-semibold gap-2 mt-1 border-0"
                  >
                    <Check className="w-4 h-4 text-white" />
                    {t("packSettings.createVersionBtn", { version: newVersionName.trim() || t("packSettings.versionFallback") })}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Select value={currentVersion} onValueChange={handleVersionChange}>
                    <SelectTrigger 
                      ref={versionTriggerRef}
                      className="bg-muted/70 border-2 border-border text-foreground focus:ring-0 focus:border-[#FE5000] h-11 rounded-xl flex-1"
                    >
                      <SelectValue placeholder={t("packSettings.selectVersion")} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-2 border-border text-popover-foreground rounded-xl">
                      {livePack.versions.map((ver) => (
                        <SelectItem key={ver} value={ver} className="focus:bg-muted focus:text-[#FE5000]">
                          {ver}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ActionButton 
                    type="button"
                    size="lg"
                    color="orange"
                    tooltip={t("packSettings.createNewVersionTooltip")}
                    onClick={() => setIsCreatingVersion(true)}
                    icon={<Plus className="w-5 h-5" />}
                  />
                  {livePack.versions.length > 1 && (
                    <ActionButton 
                      type="button"
                      size="lg"
                      color="red"
                      tooltip={t("packSettings.deleteVersionTooltip", { version: currentVersion })}
                      onClick={() => handlePromptDelete(currentVersion)}
                      icon={<Trash2 className="w-5 h-5" />}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Minecraft Version */}
              <div className="flex flex-col gap-2">
                <FieldLabel>{t("packSettings.minecraftLabel")}</FieldLabel>
                <Select value={mcVersion} onValueChange={setMcVersion}>
                  <SelectTrigger 
                    ref={mcVersionTriggerRef}
                    className="bg-muted/70 border-2 border-border text-foreground focus:ring-0 focus:border-[#FE5000] h-11 rounded-xl"
                  >
                    <SelectValue placeholder={t("packSettings.selectMcPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-2 border-border text-popover-foreground rounded-xl max-h-60 overflow-y-auto custom-scrollbar">
                    {mcVersionsList.map((v) => (
                      <SelectItem key={v} value={v} className="focus:bg-muted focus:text-[#FE5000]">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 mt-0.5">
                  <Checkbox 
                    id="show-all-mc" 
                    checked={showAllMcVersions} 
                    onCheckedChange={(checked: boolean | "indeterminate") => setShowAllMcVersions(!!checked)} 
                    className="border-border data-[state=checked]:bg-[#FE5000] data-[state=checked]:border-[#FE5000]"
                  />
                  <label htmlFor="show-all-mc" className="text-[11px] text-muted-foreground cursor-pointer select-none">
                    {t("packSettings.showAllMc")}
                  </label>
                </div>
              </div>

              {/* Loader */}
              <div className="flex flex-col gap-2">
                <FieldLabel>{t("packSettings.loaderLabel")}</FieldLabel>
                <Select value={loader} onValueChange={setLoader}>
                  <SelectTrigger 
                    ref={loaderTriggerRef}
                    className="bg-muted/70 border-2 border-border text-foreground focus:ring-0 focus:border-[#FE5000] h-11 rounded-xl"
                  >
                    <SelectValue placeholder={t("packSettings.selectLoaderPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-2 border-border text-popover-foreground rounded-xl max-h-60 overflow-y-auto custom-scrollbar">
                    {loadersList.map((l) => (
                      <SelectItem key={l.id} value={l.id} className="focus:bg-muted focus:text-[#FE5000]">
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 mt-0.5">
                  <Checkbox 
                    id="show-all-loaders" 
                    checked={showAllLoaders} 
                    onCheckedChange={(checked: boolean | "indeterminate") => setShowAllLoaders(!!checked)} 
                    className="border-border data-[state=checked]:bg-[#FE5000] data-[state=checked]:border-[#FE5000]"
                  />
                  <label htmlFor="show-all-loaders" className="text-[11px] text-muted-foreground cursor-pointer select-none">
                    {t("packSettings.showAllLoaders")}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 px-6 border-t border-border bg-card flex sm:justify-between items-center gap-3">
            {!isFirstPack && !isCreateMode ? (
              <ActionButton
                type="button"
                size="lg"
                color="red"
                icon={<Trash2 className="w-4 h-4" />}
                label={t("packSettings.deletePackageBtn")}
                tooltip={t("packSettings.deletePackageBtn")}
                onClick={() => setIsConfirmDeletePackOpen(true)}
              />
            ) : (
              <div />
            )}

            <Button 
              onClick={handleSave} 
              disabled={!name.trim()}
              className="bg-[#FE5000] text-white hover:bg-[#E04700] rounded-xl px-6 h-11 font-semibold outline outline-2 outline-transparent hover:outline-[#FE5000]/50 hover:outline-offset-2 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
            >
              {isCreateMode ? t("packSettings.createModpkgBtn") : t("packSettings.saveChangesBtn")}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Deleting Version */}
      <DeleteConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t("packSettings.deleteVersionModalTitle")}
        itemName={t("packSettings.deleteVersionItem", { version: versionToDelete })}
      />

      {/* Confirmation Dialog for Deleting MODPKG */}
      <DeleteConfirmDialog
        isOpen={isConfirmDeletePackOpen}
        onClose={() => setIsConfirmDeletePackOpen(false)}
        onConfirm={() => {
          setIsConfirmDeletePackOpen(false);
          deletePack(livePack.id);
          onClose();
        }}
        title={t("packSettings.deletePackageModalTitle")}
        itemName={livePack.name}
        description={t("packSettings.deletePackageModalDesc", { name: livePack.name, id: livePack.id })}
      />
    </>
  );
}
