import { useState, useEffect, useRef } from "react";
import { 
  FileSliders, 
  Code2, 
  Upload, 
  Globe, 
  Save, 
  RotateCcw, 
  Trash2, 
  ExternalLink, 
  Check, 
  Pencil, 
  Plus,
  Layers,
  FileCode,
  FolderUp,
  X,
  Archive,
  Database,
  Binary,
  Download,
  RefreshCw,
  FileArchive,
  Image as ImageIcon,
  Music,
  Video
} from "lucide-react";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { FileTypeIcon } from "@/components/common/content-type-icon";
import { StorageBadge } from "@/components/common/storage-badge";
import { DeleteConfirmDialog } from "@/components/common/delete-confirm-dialog";
import { AddConfigFileDialog } from "@/components/views/add-config-file-dialog";
import { usePack } from "@/context/pack-context";
import { CustomFileItem, CustomFileType } from "@/types";
import { 
  extractFilesFromDrop, 
  normalizeImportPaths, 
  processFileToCustomItem 
} from "@/lib/folder-import";
import { 
  CUSTOM_FILE_TYPES, 
  detectFileType, 
  detectMonacoLanguage,
  isUnsupportedBinary,
  isMediaFile,
  formatFileSize,
  getFileExtension,
  MEDIA_IMAGE_EXTS,
  MEDIA_AUDIO_EXTS,
  MEDIA_VIDEO_EXTS,
} from "@/lib/storage/config-files-storage";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

type ContentMode = "edit" | "upload" | "url";

function getBinaryIcon(fileName: string) {
  const ext = getFileExtension(fileName);
  if (["jar", "zip", "tar", "gz", "7z", "rar", "bz2", "pak"].includes(ext)) {
    return <Archive className="w-8 h-8" />;
  }
  if (["dat", "dat_old", "nbt", "mca", "mcr", "schem", "schematic"].includes(ext)) {
    return <Database className="w-8 h-8" />;
  }
  if (["class", "exe", "dll", "so", "dylib", "bin"].includes(ext)) {
    return <Binary className="w-8 h-8" />;
  }
  return <FileArchive className="w-8 h-8" />;
}

const getUrlMediaType = (url: string, fileType?: CustomFileType): "image" | "video" | "audio" | "other" => {
  if (fileType === "multimedia") return "image";
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(clean)) return "image";
  if (/\.(mp4|webm|ogv)$/i.test(clean)) return "video";
  if (/\.(mp3|wav|ogg)$/i.test(clean)) return "audio";
  return "other";
};

export interface CustomFilesWorkspaceProps {
  selectedFileId: string | null;
  onSelectFile: (id: string | null) => void;
  onOpenAddDialog: () => void;
}

export function CustomFilesWorkspace({
  selectedFileId,
  onSelectFile,
  onOpenAddDialog,
}: CustomFilesWorkspaceProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const monacoTheme = theme === "light" ? "light" : "vs-dark";
  const { customFiles, updateCustomFile, removeCustomFile, addCustomFilesBatch } = usePack();

  const workspaceFolderInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingWorkspaceFolder, setIsDraggingWorkspaceFolder] = useState(false);
  const workspaceDragCounter = useRef(0);

  const processAndImportWorkspaceFiles = async (rawFiles: { file: File; path: string }[]) => {
    if (rawFiles.length === 0) return;
    const totalFiles = rawFiles.length;
    const toastId = toast.loading(
      t("editor.fileTree.importingProgress", { count: totalFiles })
    );

    try {
      const normalized = normalizeImportPaths(rawFiles);
      const items: CustomFileItem[] = [];
      const CHUNK_SIZE = 50;

      for (let i = 0; i < normalized.length; i += CHUNK_SIZE) {
        const chunk = normalized.slice(i, i + CHUNK_SIZE);
        const chunkItems = await Promise.all(
          chunk.map((entry) => processFileToCustomItem(entry.file, entry.cleanPath))
        );
        items.push(...chunkItems);

        if (totalFiles > 100 && (i % 150 === 0 || i + CHUNK_SIZE >= normalized.length)) {
          const currentProcessed = Math.min(i + CHUNK_SIZE, totalFiles);
          toast.loading(
            t("editor.fileTree.importingProgressDetailed", {
              current: currentProcessed,
              total: totalFiles,
            }),
            { id: toastId }
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      addCustomFilesBatch(items);
      toast.success(t("editor.fileTree.importSuccess", { count: items.length }), { id: toastId });
    } catch (err: any) {
      console.error("Failed to import files:", err);
      toast.error(t("editor.fileTree.importError", "Error al importar archivos"), { id: toastId });
    }
  };

  const handleWorkspaceFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    const rawEntries = filesArray.map((f) => ({
      file: f,
      path: f.webkitRelativePath || f.name,
    }));
    await processAndImportWorkspaceFiles(rawEntries);
    if (workspaceFolderInputRef.current) {
      workspaceFolderInputRef.current.value = "";
    }
  };

  const handleWorkspaceDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    workspaceDragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingWorkspaceFolder(true);
    }
  };

  const handleWorkspaceDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleWorkspaceDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    workspaceDragCounter.current--;
    if (workspaceDragCounter.current <= 0) {
      setIsDraggingWorkspaceFolder(false);
      workspaceDragCounter.current = 0;
    }
  };

  const handleWorkspaceDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingWorkspaceFolder(false);
    workspaceDragCounter.current = 0;

    if (!e.dataTransfer) return;
    const extracted = await extractFilesFromDrop(e.dataTransfer);
    const rawEntries = extracted.map((item) => ({
      file: item.file,
      path: item.relativePath,
    }));
    await processAndImportWorkspaceFiles(rawEntries);
  };

  const MODE_TABS: { id: ContentMode; label: string; icon: React.ReactNode }[] = [
    { id: "edit", label: t("editor.customFiles.modes.edit"), icon: <Code2 className="w-3.5 h-3.5" /> },
    { id: "upload", label: t("editor.customFiles.modes.upload"), icon: <Upload className="w-3.5 h-3.5" /> },
    { id: "url", label: t("editor.customFiles.modes.url"), icon: <Globe className="w-3.5 h-3.5" /> },
  ];

  const file = customFiles.find((f) => f.id === selectedFileId) || null;

  // Local draft state
  const [draftName, setDraftName] = useState<string>("");
  const [draftTargetPath, setDraftTargetPath] = useState<string>("");
  const [draftType, setDraftType] = useState<CustomFileType>("config");
  const [draftContentMode, setDraftContentMode] = useState<ContentMode>("edit");
  const [draftContent, setDraftContent] = useState<string>("");
  const [draftSourceUrl, setDraftSourceUrl] = useState<string>("");
  const [isSavedRecently, setIsSavedRecently] = useState<boolean>(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync draft state whenever selected file changes
  useEffect(() => {
    if (file) {
      setDraftName(file.name);
      setDraftTargetPath(file.targetPath);
      setDraftType(file.type);
      setDraftContent(file.content ?? "");
      setDraftSourceUrl(file.sourceUrl ?? "");
      setDraftContentMode(file.sourceUrl ? "url" : "edit");
      setUploadFileName(null);
      setIsSavedRecently(false);
    } else {
      setDraftName("");
      setDraftTargetPath("");
      setDraftType("config");
      setDraftContent("");
      setDraftSourceUrl("");
      setDraftContentMode("edit");
      setUploadFileName(null);
      setIsSavedRecently(false);
    }
  }, [file?.id]);

  const monacoLang = detectMonacoLanguage(draftTargetPath);
  const mediaType = getUrlMediaType(draftSourceUrl, draftType);

  const replaceInputRef = useRef<HTMLInputElement>(null);
  const isBinary = isUnsupportedBinary(file);
  const isMedia = isMediaFile(file);

  const handleDownloadFile = () => {
    if (!file) return;
    if (file.sourceUrl) {
      window.open(file.sourceUrl, "_blank");
      return;
    }
    if (!file.content) return;
    const link = document.createElement("a");
    link.href = file.content.startsWith("data:")
      ? file.content
      : `data:application/octet-stream;base64,${file.content}`;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReplaceBinaryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0];
    if (!newFile || !file) return;
    try {
      const updatedItem = await processFileToCustomItem(newFile, file.targetPath);
      const updated: CustomFileItem = {
        ...file,
        name: newFile.name,
        content: updatedItem.content,
        size: newFile.size,
        isBinary: updatedItem.isBinary,
        type: updatedItem.type,
        updatedAt: new Date().toISOString(),
      };
      updateCustomFile(updated);
      setDraftName(newFile.name);
      setDraftContent(updatedItem.content ?? "");
      setDraftType(updatedItem.type);
      toast.success(t("editor.customFiles.fileReplaced", "Archivo reemplazado correctamente"));
    } catch (err) {
      console.error("Failed to replace file:", err);
      toast.error(t("editor.customFiles.fileReplaceError", "Error al reemplazar el archivo"));
    } finally {
      if (replaceInputRef.current) {
        replaceInputRef.current.value = "";
      }
    }
  };

  const isDirty = file
    ? draftName !== file.name ||
      draftTargetPath !== file.targetPath ||
      draftType !== file.type ||
      draftContent !== (file.content ?? "") ||
      draftSourceUrl !== (file.sourceUrl ?? "")
    : false;

  const handleSave = () => {
    if (!file) return;
    const updated: CustomFileItem = {
      ...file,
      name: draftName.trim() || file.name,
      targetPath: draftTargetPath.trim() || "/",
      type: draftType,
      content: draftContentMode !== "url" ? draftContent : undefined,
      sourceUrl: draftContentMode === "url" ? draftSourceUrl.trim() : undefined,
      updatedAt: new Date().toISOString(),
    };
    updateCustomFile(updated);
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2000);
  };

  const handleReset = () => {
    if (file) {
      setDraftName(file.name);
      setDraftTargetPath(file.targetPath);
      setDraftType(file.type);
      setDraftContent(file.content ?? "");
      setDraftSourceUrl(file.sourceUrl ?? "");
      setDraftContentMode(file.sourceUrl ? "url" : "edit");
      setUploadFileName(null);
    }
  };

  const handleDelete = () => {
    if (file) {
      removeCustomFile(file.id);
      setIsConfirmDeleteOpen(false);
      onSelectFile(null);
    }
  };

  const handleUrlChange = (value: string) => {
    setDraftSourceUrl(value);
    const cleanUrl = value.trim().split("?")[0].split("#")[0];
    if (!cleanUrl) return;

    const segments = cleanUrl.split("/").filter(Boolean);
    const filename = segments[segments.length - 1];

    if (filename && filename.includes(".")) {
      const detected = detectFileType(filename);
      const isMedia = /\.(png|jpe?g|gif|webp|svg|ico|bmp|mp4|webm|ogv|mp3|wav|ogg)$/i.test(filename);
      const effectiveType = isMedia ? "multimedia" : detected;

      setDraftType(effectiveType);

      if (!draftName || draftName === "New File" || (file && draftName === file.name)) {
        setDraftName(filename);
      }
      if (!draftTargetPath || draftTargetPath === "/" || (file && draftTargetPath === file.targetPath)) {
        setDraftTargetPath(`/${filename}`);
      }
    }
  };

  // Drag & drop file upload
  const processFile = (f: File) => {
    setUploadFileName(f.name);
    if (!draftName) setDraftName(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    if (draftTargetPath === "/" || draftTargetPath === "") {
      const detected = detectFileType(f.name);
      setDraftType(detected);
      setDraftTargetPath(`config/${f.name}`);
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setDraftContent(text);
      setDraftContentMode("edit");
    };
    reader.readAsText(f);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processFile(dropped);
  };

  // When no file is selected
  if (!file) {
    return (
      <div 
        className="relative flex-1 min-w-0 bg-background flex flex-col items-center justify-center p-8 text-center min-h-[calc(100vh-121px)]"
        onDragEnter={handleWorkspaceDragEnter}
        onDragOver={handleWorkspaceDragOver}
        onDragLeave={handleWorkspaceDragLeave}
        onDrop={handleWorkspaceDrop}
      >
        {/* Drag Over Overlay */}
        {isDraggingWorkspaceFolder && (
          <div className="absolute inset-4 z-50 rounded-3xl bg-background/90 backdrop-blur-sm border-2 border-dashed border-amber-400 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-150 pointer-events-none">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mb-3">
              <FolderUp className="w-7 h-7 text-amber-500 animate-bounce" />
            </div>
            <p className="text-base font-bold text-foreground">
              {t("editor.fileTree.dropToUpload", "Suelta las carpetas o archivos aquí")}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {t("editor.fileTree.dropToUploadDesc", "Se importarán manteniendo su jerarquía de directorios")}
            </p>
          </div>
        )}

        <Empty className="max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-amber-400/10 border border-amber-400/20 text-amber-400">
              <FileSliders className="w-7 h-7" />
            </EmptyMedia>
            <EmptyTitle className="text-foreground text-xl font-bold">
              {customFiles.length === 0 ? t("editor.customFiles.emptyPackageTitle") : t("editor.customFiles.noSelectedTitle")}
            </EmptyTitle>
            <EmptyDescription className="text-muted-foreground text-xs">
              {customFiles.length === 0
                ? t("editor.customFiles.emptyPackageDesc")
                : t("editor.customFiles.noSelectedDesc")}
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex items-center gap-3 mt-4">
            <Button
              onClick={onOpenAddDialog}
              className="bg-amber-400 text-black hover:bg-amber-300 rounded-xl px-5 h-11 font-semibold outline outline-2 outline-transparent hover:outline-amber-400/50 hover:outline-offset-2 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("editor.customFiles.addCustomFile")}
            </Button>
            <Button
              variant="outline"
              onClick={() => workspaceFolderInputRef.current?.click()}
              className="rounded-xl px-5 h-11 font-semibold border-border hover:bg-muted text-foreground active:scale-95 transition-all gap-2"
            >
              <FolderUp className="w-4 h-4 text-amber-500" />
              {t("editor.fileTree.uploadFolder")}
            </Button>
          </div>

          <input
            ref={workspaceFolderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is non-standard
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleWorkspaceFolderSelect}
          />
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 bg-background flex flex-col min-h-[calc(100vh-121px)] h-[calc(100vh-121px)] overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-3.5 px-6 border-b border-border bg-card flex items-center justify-between gap-4 shrink-0 flex-wrap">
        {/* Left: Icon, Name and Target Path inputs (tightly together) */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
            <FileTypeIcon type={draftType} />
          </div>

          <div className="flex flex-col min-w-0 flex-1 max-w-md">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={t("editor.customFiles.fileNamePlaceholder")}
              className="bg-transparent text-foreground font-bold text-sm leading-tight focus:bg-muted px-1.5 py-0.5 rounded-md border border-transparent focus:border-amber-400/50 focus:outline-none transition-all truncate"
            />
            <input
              type="text"
              value={draftTargetPath}
              onChange={(e) => {
                setDraftTargetPath(e.target.value);
                const filename = e.target.value.split("/").pop() ?? "";
                if (filename.includes(".")) {
                  const detected = detectFileType(filename);
                  setDraftType(detected);
                }
              }}
              placeholder={t("editor.customFiles.targetPathPlaceholder")}
              className="bg-transparent text-muted-foreground font-mono text-[11px] leading-tight focus:bg-muted px-1.5 py-0.5 rounded-md border border-transparent focus:border-amber-400/50 focus:outline-none transition-all w-80 truncate"
            />
          </div>
        </div>

        {/* Right: Content Mode Tabs, Storage Badge & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Content Mode Tabs or Binary / Media Badge */}
          {isBinary ? (
            <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-xl border border-border">
              <FileArchive className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-muted-foreground">
                {t("editor.customFiles.binaryBadge", "Archivo binario")}
              </span>
            </div>
          ) : isMedia ? (
            <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-xl border border-border">
              <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-muted-foreground">
                {t("editor.customFiles.multimediaBadge", "Multimedia")}
              </span>
            </div>
          ) : draftType === "multimedia" ? (
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-400 text-black shadow-sm">
                <Globe className="w-3.5 h-3.5" />
                {t("editor.customFiles.modes.url")}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
              {MODE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDraftContentMode(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    draftContentMode === tab.id
                      ? "bg-amber-400 text-black shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="h-4 w-px bg-border mx-1" />

          <StorageBadge storageType={file.storageLocation} />

          <div className="h-4 w-px bg-border mx-1" />

          {isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl text-xs h-9 px-3 gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("editor.customFiles.reset")}
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty && !isSavedRecently}
            className={cn(
              "rounded-xl text-xs font-semibold h-9 px-4 gap-1.5 transition-all cursor-pointer",
              isSavedRecently
                ? "bg-emerald-500 text-white"
                : "bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40"
            )}
          >
            {isSavedRecently ? (
              <>
                <Check className="w-3.5 h-3.5" />
                {t("editor.customFiles.saved")}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {t("editor.customFiles.saveChanges")}
              </>
            )}
          </Button>

          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditDialogOpen(true)}
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs shadow-xl">
                {t("editor.customFiles.editFullDetails")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs shadow-xl">
                {t("editor.customFiles.deleteCustomFile")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSelectFile(null)}
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs shadow-xl">
                {t("editor.customFiles.closeFile")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Editor Main Content Area */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-background">
        {/* Dedicated Binary File View */}
        {isBinary ? (
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center overflow-y-auto custom-scrollbar">
            <div className="max-w-md w-full bg-card border border-border/80 shadow-sm rounded-3xl p-8 flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-500 mb-4 shadow-inner">
                {getBinaryIcon(file.name)}
              </div>

              <h3 className="text-lg font-bold text-foreground truncate max-w-full px-2" title={file.name}>
                {draftName || file.name}
              </h3>

              <p className="font-mono text-xs text-muted-foreground mt-1 mb-4 break-all bg-muted/60 px-3 py-1.5 rounded-xl border border-border/50">
                {draftTargetPath || file.targetPath}
              </p>

              {/* Badges */}
              <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
                <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border">
                  {formatFileSize(file.size || (file.content ? Math.round(file.content.length * 0.75) : 0))}
                </span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-400/20 uppercase font-mono">
                  .{getFileExtension(file.name).toUpperCase() || "BIN"}
                </span>
                <StorageBadge storageType={file.storageLocation} />
              </div>

              <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
                {t(
                  "editor.customFiles.binaryNoticeDesc",
                  "Este archivo binario no se puede editar como texto en el editor web. Se empaquetará automáticamente en la carpeta de overrides al exportar el paquete."
                )}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-2.5 flex-wrap justify-center w-full">
                {(file.content || file.sourceUrl) && (
                  <Button
                    variant="outline"
                    onClick={handleDownloadFile}
                    className="rounded-xl h-10 px-4 text-xs font-semibold gap-2 border-border hover:bg-muted active:scale-95 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-500" />
                    {t("editor.customFiles.downloadFile", "Descargar")}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => replaceInputRef.current?.click()}
                  className="rounded-xl h-10 px-4 text-xs font-semibold gap-2 border-border hover:bg-muted active:scale-95 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                  {t("editor.customFiles.replaceFile", "Reemplazar")}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="rounded-xl h-10 px-4 text-xs font-semibold gap-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("common.delete", "Eliminar")}
                </Button>
              </div>

              <input
                ref={replaceInputRef}
                type="file"
                className="hidden"
                onChange={handleReplaceBinaryFile}
              />
            </div>
          </div>
        ) : isMedia ? (
          /* Media Preview View (Image, Audio, Video) */
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center overflow-y-auto custom-scrollbar">
            <div className="max-w-lg w-full bg-card border border-border/80 shadow-sm rounded-3xl p-6 flex flex-col items-center">
              {/* Media Container */}
              <div className="w-full flex items-center justify-center p-4 bg-muted/30 rounded-2xl overflow-hidden border border-border mb-4 min-h-[200px] max-h-[360px]">
                {MEDIA_IMAGE_EXTS.has(getFileExtension(file.name)) ? (
                  <img
                    src={file.content?.startsWith("data:") ? file.content : (file.sourceUrl || file.content)}
                    alt={file.name}
                    className="max-h-72 object-contain rounded-lg shadow-sm"
                  />
                ) : MEDIA_AUDIO_EXTS.has(getFileExtension(file.name)) ? (
                  <div className="w-full py-6 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-500">
                      <Music className="w-6 h-6" />
                    </div>
                    <audio
                      src={file.content?.startsWith("data:") ? file.content : (file.sourceUrl || file.content)}
                      controls
                      className="w-full max-w-sm"
                    />
                  </div>
                ) : MEDIA_VIDEO_EXTS.has(getFileExtension(file.name)) ? (
                  <video
                    src={file.content?.startsWith("data:") ? file.content : (file.sourceUrl || file.content)}
                    controls
                    className="max-h-72 w-full rounded-lg"
                  />
                ) : null}
              </div>

              <h3 className="text-base font-bold text-foreground truncate max-w-full px-2" title={file.name}>
                {draftName || file.name}
              </h3>

              <p className="font-mono text-xs text-muted-foreground mt-1 mb-4 break-all bg-muted/60 px-3 py-1 rounded-xl border border-border/50">
                {draftTargetPath || file.targetPath}
              </p>

              {/* Badges */}
              <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
                <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border">
                  {formatFileSize(file.size || (file.content ? Math.round(file.content.length * 0.75) : 0))}
                </span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-400/20 uppercase font-mono">
                  .{getFileExtension(file.name).toUpperCase()}
                </span>
                <StorageBadge storageType={file.storageLocation} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2.5 flex-wrap justify-center w-full">
                {(file.content || file.sourceUrl) && (
                  <Button
                    variant="outline"
                    onClick={handleDownloadFile}
                    className="rounded-xl h-10 px-4 text-xs font-semibold gap-2 border-border hover:bg-muted active:scale-95 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-500" />
                    {t("editor.customFiles.downloadFile", "Descargar")}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => replaceInputRef.current?.click()}
                  className="rounded-xl h-10 px-4 text-xs font-semibold gap-2 border-border hover:bg-muted active:scale-95 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                  {t("editor.customFiles.replaceFile", "Reemplazar")}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="rounded-xl h-10 px-4 text-xs font-semibold gap-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("common.delete", "Eliminar")}
                </Button>
              </div>

              <input
                ref={replaceInputRef}
                type="file"
                className="hidden"
                onChange={handleReplaceBinaryFile}
              />
            </div>
          </div>
        ) : (
          <>
        {/* EDIT MODE: Monaco Code Editor */}
        {draftContentMode === "edit" && draftType !== "multimedia" && (
          <div className="flex-1 w-full h-full">
            <Editor
              height="100%"
              language={monacoLang}
              value={draftContent}
              onChange={(v) => setDraftContent(v ?? "")}
              theme={monacoTheme}
              options={{
                automaticLayout: true,
                fontSize: 13,
                tabSize: 2,
                fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                renderLineHighlight: "all",
                padding: { top: 8, bottom: 8 },
                wordWrap: "on",
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
              }}
            />
          </div>
        )}

        {/* UPLOAD MODE */}
        {draftContentMode === "upload" && draftType !== "multimedia" && (
          <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.json,.yaml,.yml,.toml,.ini,.properties,.cfg,.conf,.log,.md,.js,.ts,.html,.css,.java,.py,.sh,.cmd,.bat,.mcmeta"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center gap-3 w-full h-44 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none",
                isDragging
                  ? "border-amber-400 bg-amber-400/10 text-amber-400 scale-[0.99]"
                  : "border-border hover:border-amber-400/50 bg-muted/40 hover:bg-amber-400/5 text-muted-foreground hover:text-amber-500"
              )}
            >
              <Upload className={cn("w-8 h-8", isDragging && "animate-bounce")} />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">
                  {isDragging ? t("editor.customFiles.dropFileUpload") : t("editor.customFiles.clickOrDrag")}
                </span>
                <span className="text-xs text-muted-foreground">{t("editor.customFiles.uploadFormats")}</span>
              </div>
            </button>

            {uploadFileName && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-400/10 border border-amber-400/20 rounded-xl w-fit">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-foreground font-mono">{uploadFileName}</span>
              </div>
            )}

            {draftContent && (
              <div className="flex-1 min-h-[360px] rounded-2xl overflow-hidden border border-border bg-card">
                <Editor
                  height="360px"
                  language={monacoLang}
                  value={draftContent}
                  onChange={(v) => setDraftContent(v ?? "")}
                  theme={monacoTheme}
                  options={{
                    automaticLayout: true,
                    fontSize: 12,
                    tabSize: 2,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: "on",
                    padding: { top: 8, bottom: 8 },
                    wordWrap: "on",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* URL MODE */}
        {(draftContentMode === "url" || draftType === "multimedia") && (
          <div className="flex-1 p-6 flex flex-col gap-6 max-w-4xl overflow-y-auto custom-scrollbar">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("editor.customFiles.directFileUrl")}
              </label>
              <Input
                value={draftSourceUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com/asset.png or https://example.com/config.json"
                className="bg-muted/50 border-border text-foreground h-11 rounded-xl font-mono text-sm focus-visible:border-amber-400"
              />
              <p className="text-xs text-muted-foreground">
                {t("editor.customFiles.directFileUrlDesc")}
              </p>
            </div>

            {draftSourceUrl.trim() && (
              <div className="flex flex-col gap-4">
                <a
                  href={draftSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1.5 w-fit font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t("editor.customFiles.openUrl")}
                </a>

                {/* Media Preview */}
                {mediaType === "image" && (
                  <div className="flex flex-col gap-2 p-5 bg-card border border-border rounded-2xl">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("editor.customFiles.imagePreview")}
                    </span>
                    <div className="flex items-center justify-center p-4 bg-muted/40 rounded-xl overflow-hidden border border-border min-h-[260px]">
                      <img
                        src={draftSourceUrl}
                        alt="Media Preview"
                        className="max-h-96 object-contain rounded-lg shadow-xl"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  </div>
                )}

                {mediaType === "video" && (
                  <div className="flex flex-col gap-2 p-5 bg-card border border-border rounded-2xl">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("editor.customFiles.videoPreview")}
                    </span>
                    <div className="flex items-center justify-center p-4 bg-muted/40 rounded-xl overflow-hidden border border-border">
                      <video src={draftSourceUrl} controls className="max-h-96 w-full rounded-lg shadow-xl" />
                    </div>
                  </div>
                )}

                {mediaType === "audio" && (
                  <div className="flex flex-col gap-2 p-5 bg-card border border-border rounded-2xl">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("editor.customFiles.audioPlayer")}
                    </span>
                    <div className="p-4 bg-muted/40 rounded-xl border border-border">
                      <audio src={draftSourceUrl} controls className="w-full" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* Full Edit Modal Dialog */}
      {isEditDialogOpen && (
        <AddConfigFileDialog
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          editItem={file}
          context="editor"
          onUpdated={(updated) => {
            updateCustomFile(updated);
            setIsEditDialogOpen(false);
          }}
          onDeleted={() => {
            removeCustomFile(file.id);
            setIsEditDialogOpen(false);
            onSelectFile(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t("editor.customFiles.deleteModalTitle")}
        itemName={file.name}
      />
    </div>
  );
}
