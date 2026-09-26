import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSliders, Pencil, Upload, Globe, Code2, Check, Trash2, X, FileArchive } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";
import { FileTypeIcon } from "@/components/common/content-type-icon";
import { ResourceOptionsSection } from "@/components/views/resource-options-section";
import { DeleteConfirmDialog } from "@/components/common/delete-confirm-dialog";
import { usePack } from "@/context/pack-context";
import {
  saveCustomFileItem,
  updateCustomFileItem,
  deleteCustomFileItem,
  CUSTOM_FILE_TYPES,
  detectFileType,
  detectMonacoLanguage,
  isUnsupportedBinary,
  formatFileSize,
} from "@/lib/storage/config-files-storage";
import { CustomFileItem, CustomFileType, CustomStorageLocation } from "@/types";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

export interface AddConfigFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded?: (item: CustomFileItem) => void;
  onUpdated?: (item: CustomFileItem) => void;
  onDeleted?: (id: string) => void;
  editItem?: CustomFileItem | null;
  isLoggedIn?: boolean;
  context?: "standalone" | "editor";
  defaultAddToPackage?: boolean;
  defaultSaveAsCommon?: boolean;
  initialTargetPath?: string;
}

type ContentMode = "edit" | "upload" | "url";

const MODE_TABS: { id: ContentMode; labelKey: string; icon: React.ReactNode }[] = [
  { id: "edit", labelKey: "editor.customFiles.modes.edit", icon: <Code2 className="w-3.5 h-3.5" /> },
  { id: "upload", labelKey: "editor.customFiles.modes.upload", icon: <Upload className="w-3.5 h-3.5" /> },
  { id: "url", labelKey: "editor.customFiles.modes.url", icon: <Globe className="w-3.5 h-3.5" /> },
];

const getUrlMediaType = (url: string, fileType?: CustomFileType): "image" | "video" | "audio" | "other" => {
  if (fileType === "multimedia") return "image";
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(clean)) return "image";
  if (/\.(mp4|webm|ogv)$/i.test(clean)) return "video";
  if (/\.(mp3|wav|ogg)$/i.test(clean)) return "audio";
  return "other";
};

export function AddConfigFileDialog({
  isOpen,
  onClose,
  onAdded,
  onUpdated,
  onDeleted,
  editItem,
  isLoggedIn = false,
  context = "standalone",
  defaultAddToPackage = true,
  defaultSaveAsCommon = true,
  initialTargetPath,
}: AddConfigFileDialogProps) {
  const { t } = useTranslation();
  const { addCustomFile, updateCustomFile, removeCustomFile } = usePack();
  const { theme } = useTheme();
  const [name, setName] = useState("");
  const [targetPath, setTargetPath] = useState(initialTargetPath || "/");
  const [type, setType] = useState<CustomFileType>("config");
  const [contentMode, setContentMode] = useState<ContentMode>("edit");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [saveToCloud, setSaveToCloud] = useState(false);
  const [addToPackage, setAddToPackage] = useState<boolean>(defaultAddToPackage);
  const [saveAsCommon, setSaveAsCommon] = useState<boolean>(defaultSaveAsCommon);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [userEditedName, setUserEditedName] = useState(false);
  const [userEditedPath, setUserEditedPath] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monacoLang = detectMonacoLanguage(targetPath);
  const mediaType = getUrlMediaType(sourceUrl, type);
  const isBinaryItem = isUnsupportedBinary(editItem);

  // Reset form on open
  useEffect(() => {
    if (!isOpen) return;
    setUserEditedName(false);
    setUserEditedPath(false);
    if (editItem) {
      setName(editItem.name);
      setTargetPath(editItem.targetPath);
      setType(editItem.type);
      setContent(isBinaryItem ? "" : (editItem.content ?? ""));
      setSourceUrl(editItem.sourceUrl ?? "");
      setSaveToCloud(editItem.storageLocation === "account_cloud");
      setContentMode(editItem.sourceUrl ? "url" : "edit");
      setUploadFileName(null);
      setAddToPackage(defaultAddToPackage);
      setSaveAsCommon(defaultSaveAsCommon);
    } else {
      setName("");
      setTargetPath(initialTargetPath || "/");
      setType("config");
      setContentMode("edit");
      setContent("");
      setSourceUrl("");
      setSaveToCloud(false);
      setUploadFileName(null);
      setAddToPackage(defaultAddToPackage);
      setSaveAsCommon(defaultSaveAsCommon);
    }
  }, [isOpen, editItem, defaultAddToPackage, defaultSaveAsCommon, initialTargetPath]);

  // Auto-detect type and filename from URL
  const handleUrlChange = (value: string) => {
    setSourceUrl(value);
    const cleanUrl = value.trim().split("?")[0].split("#")[0];
    if (!cleanUrl) return;

    const segments = cleanUrl.split("/").filter(Boolean);
    const filename = segments[segments.length - 1];

    if (filename && filename.includes(".")) {
      const detected = detectFileType(filename);
      const isMedia = /\.(png|jpe?g|gif|webp|svg|ico|bmp|mp4|webm|ogv|mp3|wav|ogg)$/i.test(filename);
      const effectiveType = isMedia ? "multimedia" : detected;

      setType(effectiveType);

      if (!userEditedName || !name.trim()) {
        setName(filename);
      }
      if (!userEditedPath || !targetPath.trim() || targetPath === "/") {
        setTargetPath(`/${filename}`);
      }
    }
  };

  // Auto-detect type from path extension
  const handlePathChange = (value: string) => {
    setTargetPath(value);
    const filename = value.split("/").pop() ?? "";
    if (filename.includes(".")) {
      const detected = detectFileType(filename);
      setType(detected);
      if (detected === "multimedia") {
        setContentMode("url");
      }
    }
  };

  const handleTypeChange = (newType: CustomFileType) => {
    setType(newType);
    if (newType === "multimedia") {
      setContentMode("url");
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File) => {
    setUploadFileName(file.name);
    if (!name) setName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    if (targetPath === "/" || targetPath === "") {
      setTargetPath(`/${file.name}`);
    }
    setType(detectFileType(file.name));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setContent(text ?? "");
      setContentMode("edit");
    };
    reader.readAsText(file);
  };

  // Handle file upload (Text & Config files only)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const isValid = !!name.trim() && !!targetPath.trim() &&
    (isBinaryItem || (contentMode === "edit" ? !!content.trim() : contentMode === "url" ? !!sourceUrl.trim() : !!content.trim()));

  const handleSave = () => {
    if (!isValid) return;
    const storageLocation: CustomStorageLocation = saveToCloud && isLoggedIn ? "account_cloud" : "local_browser";

    const payload = {
      name: name.trim(),
      targetPath: targetPath.trim() || "/",
      type,
      content: isBinaryItem ? editItem?.content : (contentMode !== "url" ? content : undefined),
      sourceUrl: contentMode === "url" ? sourceUrl.trim() : undefined,
      storageLocation,
      isBinary: editItem?.isBinary,
      size: editItem?.size,
    };

    if (context === "editor") {
      const id = editItem ? editItem.id : `file-${Date.now()}`;
      const fileItem: CustomFileItem = {
        id,
        ...payload,
        createdAt: editItem ? editItem.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (addToPackage) {
        if (editItem) {
          updateCustomFile(fileItem);
        } else {
          addCustomFile(fileItem);
        }
      } else if (editItem) {
        removeCustomFile(editItem.id);
      }

      if (saveAsCommon) {
        if (editItem) {
          updateCustomFileItem(editItem.id, payload);
        } else {
          saveCustomFileItem(payload);
        }
      }

      if (editItem) {
        onUpdated?.(fileItem);
      } else {
        onAdded?.(fileItem);
      }
    } else {
      if (editItem) {
        const updated = updateCustomFileItem(editItem.id, payload);
        if (updated) onUpdated?.(updated);
      } else {
        const created = saveCustomFileItem(payload);
        onAdded?.(created);
      }
    }
    onClose();
  };

  const handleConfirmDelete = () => {
    if (editItem) {
      if (context === "editor") {
        removeCustomFile(editItem.id);
      }
      deleteCustomFileItem(editItem.id);
      onDeleted?.(editItem.id);
    }
    setIsConfirmDeleteOpen(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideClose className="dialog-accent-amber w-[95vw] max-w-[1360px] bg-card border border-border p-0 gap-0 overflow-hidden shadow-2xl rounded-2xl text-foreground">

        <DialogHeader className="p-5 px-6 border-b border-border flex flex-row items-center justify-between shrink-0 space-y-0">
          <div className="flex items-center gap-4">
            {editItem ? (
              <Pencil className="w-8 h-8 text-amber-400 shrink-0" />
            ) : (
              <FileSliders className="w-8 h-8 text-amber-400 shrink-0" />
            )}
            <div className="flex flex-col text-left justify-center">
              <DialogTitle className="text-foreground text-lg font-bold leading-tight">
                {editItem ? t("addConfigFile.editTitle") : t("addConfigFile.createTitle")}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editItem
                  ? t("addConfigFile.editSubtitle")
                  : t("addConfigFile.createSubtitle")}
              </p>
            </div>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              onClick={onClose}
              title={t("common.close")}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="max-h-[78vh] w-full">
          <div className="p-6 flex flex-col md:flex-row gap-6">

            {/* Left Column — 320px fixed width */}
            <div className="flex flex-col gap-4 w-full md:w-[320px] shrink-0">

              {/* Friendly Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("addConfigFile.displayName")}
                </label>
                <Input
                  autoFocus={!editItem}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setUserEditedName(true);
                  }}
                  placeholder='e.g. "My Graphics Settings"'
                  className="bg-muted/70 border-border text-foreground h-11 rounded-xl focus-visible:border-amber-400"
                />
              </div>

              {/* Target Path */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("addConfigFile.targetPath")}
                </label>
                <Input
                  value={targetPath}
                  onChange={(e) => {
                    handlePathChange(e.target.value);
                    setUserEditedPath(true);
                  }}
                  placeholder="/options.txt"
                  className="bg-muted/70 border-border text-foreground h-11 rounded-xl font-mono text-sm focus-visible:border-amber-400"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("addConfigFile.targetPathHint")}
                </p>
              </div>

              {/* File Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("addConfigFile.fileType")}
                </label>
                <Select value={type} onValueChange={(v) => handleTypeChange(v as CustomFileType)}>
                  <SelectTrigger className="bg-muted/70 border-2 border-border text-foreground focus:ring-0 focus:border-amber-400 h-11 rounded-xl">
                    <div className="flex items-center gap-2">
                      <FileTypeIcon type={type} />
                      <span>{t(`myResources.types.${type}`, { defaultValue: type })}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-2 border-border text-popover-foreground rounded-xl">
                    {CUSTOM_FILE_TYPES.map((tItem) => (
                      <SelectItem key={tItem.value} value={tItem.value} className="focus:bg-muted focus:text-amber-400">
                        <div className="flex items-center gap-2">
                          <FileTypeIcon type={tItem.value} />
                          <span>{t(`myResources.types.${tItem.value}`, { defaultValue: tItem.label })}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Storage & Options */}
              <ResourceOptionsSection
                context={context}
                accentColor="amber"
                resourceType="file"
                showAddToPackage={false}
                addToPackage={addToPackage}
                onAddToPackageChange={setAddToPackage}
                saveToLibrary={saveAsCommon}
                onSaveToLibraryChange={setSaveAsCommon}
                saveToCloud={saveToCloud}
                onSaveToCloudChange={setSaveToCloud}
                isLoggedIn={isLoggedIn}
              />

            </div>

            {/* Right Column — Takes all remaining width */}
            <div className="flex-1 flex flex-col gap-4 border-l border-border pl-0 md:pl-6 min-w-0">

              {/* Content Mode Tabs or Binary Notice */}
              {isBinaryItem ? (
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("editor.customFiles.binaryBadge", "Archivo binario")}
                  </label>
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-border rounded-2xl min-h-[400px]">
                    <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-500 mb-3 shadow-inner">
                      <FileArchive className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-bold text-foreground max-w-sm truncate">{name || editItem?.name}</p>
                    <p className="text-xs text-muted-foreground mt-2 max-w-sm leading-relaxed">
                      {t(
                        "editor.customFiles.binaryNoticeDesc",
                        "Este archivo binario no se puede editar como texto en el editor web. Se empaquetará automáticamente en la carpeta de overrides al exportar el paquete."
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                      <span className="text-xs font-mono px-2.5 py-1 bg-muted rounded-lg text-muted-foreground border border-border">
                        {formatFileSize(editItem?.size)}
                      </span>
                      <span className="text-xs font-mono uppercase px-2.5 py-1 bg-amber-400/10 text-amber-500 rounded-lg border border-amber-400/20">
                        .{editItem?.name?.split(".").pop()?.toUpperCase() || "BIN"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("addConfigFile.contentEditor")}
                  </label>

                  {/* Mode toggle pills (URL only when type === "multimedia") */}
                  {type === "multimedia" ? (
                    <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl w-fit">
                      <button
                        type="button"
                        disabled
                        className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-amber-400 text-black shadow-sm cursor-default"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        {t("editor.customFiles.modes.url")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl w-fit">
                      {MODE_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setContentMode(tab.id)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                            contentMode === tab.id
                              ? "bg-amber-400 text-black shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tab.icon}
                          {t(tab.labelKey)}
                        </button>
                      ))}
                    </div>
                  )}

                {/* Stable Height Container for Mode Editors */}
                <div className="min-h-[420px] flex flex-col justify-start">

                  {/* Edit mode — Monaco editor */}
                  {contentMode === "edit" && type !== "multimedia" && (
                    <div className="rounded-xl overflow-hidden border border-border bg-card">
                      <Editor
                        height="410px"
                        language={monacoLang}
                        value={content}
                        onChange={(v) => setContent(v ?? "")}
                        theme={theme === "light" ? "light" : "vs-dark"}
                        options={{
                          fontSize: 12,
                          tabSize: 2,
                          fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          lineNumbers: "on",
                          renderLineHighlight: "line",
                          padding: { top: 8, bottom: 8 },
                          wordWrap: "on",
                          overviewRulerLanes: 0,
                          hideCursorInOverviewRuler: true,
                          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                        }}
                      />
                    </div>
                  )}

                  {/* Upload mode — Text/Config files only */}
                  {contentMode === "upload" && type !== "multimedia" && (
                    <div className="flex flex-col gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.json,.yaml,.yml,.toml,.ini,.properties,.cfg,.conf,.log,.md,.js,.ts,.html,.css,.java,.py,.sh,.cmd,.bat,.mcmeta"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 w-full h-36 rounded-xl border-2 border-dashed transition-all cursor-pointer select-none",
                          isDragging
                            ? "border-amber-400 bg-amber-400/10 text-amber-400 scale-[0.99]"
                            : "border-border hover:border-amber-400/50 bg-muted/30 hover:bg-amber-400/5 text-muted-foreground hover:text-amber-400"
                        )}
                      >
                        <Upload className={cn("w-6 h-6", isDragging && "animate-bounce")} />
                        <span className="text-xs font-semibold">
                          {isDragging ? t("addConfigFile.dropFile") : t("addConfigFile.clickOrDrag")}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{t("addConfigFile.uploadFormats")}</span>
                      </button>
                      {uploadFileName && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-400/10 border border-amber-400/20 rounded-xl">
                          <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-xs text-foreground/90 font-mono truncate">{uploadFileName}</span>
                        </div>
                      )}
                      {content && (
                        <div className="rounded-xl overflow-hidden border border-border">
                          <Editor
                            height="240px"
                            language={monacoLang}
                            value={content}
                            onChange={(v) => setContent(v ?? "")}
                            theme={theme === "light" ? "light" : "vs-dark"}
                            options={{
                              fontSize: 12,
                              tabSize: 2,
                              minimap: { enabled: false },
                              scrollBeyondLastLine: false,
                              lineNumbers: "on",
                              padding: { top: 8, bottom: 8 },
                              wordWrap: "on",
                              scrollbar: { verticalScrollbarSize: 6 },
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* URL mode — Supports direct file download links and image/video/audio previews */}
                  {(contentMode === "url" || type === "multimedia") && (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Input
                          autoFocus
                          value={sourceUrl}
                          onChange={(e) => handleUrlChange(e.target.value)}
                          placeholder="https://example.com/file.txt or https://example.com/image.png"
                          className="bg-muted/70 border-border text-foreground h-11 rounded-xl font-mono text-sm focus-visible:border-amber-400"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {t("addConfigFile.urlHint")}
                        </p>
                      </div>

                      {sourceUrl.trim() && (
                        <div className="flex flex-col gap-3">
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 w-fit font-semibold"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            {t("addConfigFile.openUrl")}
                          </a>

                          {/* Media Preview Player/Viewer */}
                          {mediaType === "image" && (
                            <div className="flex flex-col gap-2 p-4 bg-muted/40 border border-border rounded-xl">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {t("addConfigFile.imagePreview")}
                              </span>
                              <div className="flex items-center justify-center p-3 bg-card rounded-xl overflow-hidden border border-border min-h-[220px]">
                                <img
                                  src={sourceUrl}
                                  alt="URL Media Preview"
                                  className="max-h-72 object-contain rounded-lg shadow-lg"
                                  onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                                />
                              </div>
                            </div>
                          )}

                          {mediaType === "video" && (
                            <div className="flex flex-col gap-2 p-4 bg-muted/40 border border-border rounded-xl">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {t("addConfigFile.videoPreview")}
                              </span>
                              <div className="flex items-center justify-center p-3 bg-card rounded-xl overflow-hidden border border-border min-h-[220px]">
                                <video src={sourceUrl} controls className="max-h-72 w-full rounded-lg shadow-lg" />
                              </div>
                            </div>
                          )}

                          {mediaType === "audio" && (
                            <div className="flex flex-col gap-2 p-4 bg-muted/40 border border-border rounded-xl">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {t("addConfigFile.audioPlayer")}
                              </span>
                              <div className="p-4 bg-card rounded-xl border border-border">
                                <audio src={sourceUrl} controls className="w-full" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>

              </div>
              )}

            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="p-4 px-6 border-t border-border bg-card flex sm:justify-between items-center gap-3 shrink-0">
          {editItem && onDeleted ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl px-4 h-11 transition-all"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("common.delete")}
            </Button>
          ) : (
            <div />
          )}
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="bg-amber-400 text-black hover:bg-amber-300 rounded-xl px-6 h-11 font-semibold outline outline-2 outline-transparent hover:outline-amber-400/50 hover:outline-offset-2 active:scale-95 transition-all disabled:opacity-40"
          >
            {editItem ? t("addConfigFile.updateBtn") : t("addConfigFile.createBtn")}
          </Button>
        </DialogFooter>

      </DialogContent>

      <DeleteConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t("addConfigFile.deleteTitle")}
        itemName={name || editItem?.name}
      />
    </Dialog>
  );
}
