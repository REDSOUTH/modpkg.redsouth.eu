import { useState, useRef, useEffect, useMemo } from "react";
import { 
  Folder, 
  FolderOpen, 
  File, 
  FileCode, 
  FileText, 
  FileJson, 
  Image, 
  Archive, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Download,
  FolderUp,
  Library,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SearchInput } from "@/components/common/search-input";
import { ImportConfigFileDialog } from "@/components/views/import-config-file-dialog";
import { DeleteConfirmDialog } from "@/components/common/delete-confirm-dialog";
import { usePack } from "@/context/pack-context";
import { CustomFileItem } from "@/types";
import { detectFileType } from "@/lib/storage/config-files-storage";
import { 
  extractFilesFromDrop, 
  normalizeImportPaths, 
  processFileToCustomItem 
} from "@/lib/folder-import";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface PackageFileTreeProps {
  selectedFileId: string | null;
  onSelectFile: (id: string | null) => void;
  onOpenAddDialog: (initialPath?: string) => void;
}

interface TreeNode {
  id: string;
  name: string;
  type: "file" | "folder";
  path: string; // Full relative path like "config/options.txt"
  fileItem?: CustomFileItem;
  children?: TreeNode[];
  childrenMap?: Record<string, TreeNode>;
}

// Helper to sort tree: folders first (A-Z), followed by root/loose files (A-Z), recursively
function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  const folders = nodes.filter((n) => n.type === "folder");
  const files = nodes.filter((n) => n.type === "file");

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  const sortedFolders = folders.map((folder) => ({
    ...folder,
    children: folder.children ? sortTreeNodes(folder.children) : [],
  }));

  return [...sortedFolders, ...files];
}

export function PackageFileTree({
  selectedFileId,
  onSelectFile,
  onOpenAddDialog,
}: PackageFileTreeProps) {
  const { t } = useTranslation();
  const { 
    customFiles, 
    addCustomFile, 
    addCustomFilesBatch, 
    removeCustomFile, 
    removeCustomFolder 
  } = usePack();

  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  // Track expanded folders (all folders closed/collapsed by default)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const [isImportDialogOpen, setIsImportDialogOpen] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: "file" | "folder"; path: string } | null>(null);

  const processAndImportFiles = async (rawFiles: { file: File; path: string }[]) => {
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

        // Update progress toast on large imports
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

        // Yield to event loop to keep UI thread completely responsive
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      addCustomFilesBatch(items);
      toast.success(t("editor.fileTree.importSuccess", { count: items.length }), { id: toastId });
    } catch (err: any) {
      console.error("Failed to import files:", err);
      toast.error(t("editor.fileTree.importError", "Error al importar archivos"), { id: toastId });
    }
  };

  const handleFolderInputSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    const rawEntries = filesArray.map((f) => ({
      file: f,
      path: f.webkitRelativePath || f.name,
    }));
    await processAndImportFiles(rawEntries);
    if (folderInputRef.current) {
      folderInputRef.current.value = "";
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setIsDraggingOver(false);
      dragCounter.current = 0;
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounter.current = 0;

    if (!e.dataTransfer) return;
    const extracted = await extractFilesFromDrop(e.dataTransfer);
    const rawEntries = extracted.map((item) => ({
      file: item.file,
      path: item.relativePath,
    }));
    await processAndImportFiles(rawEntries);
  };

  // Build hierarchical tree purely from customFiles
  const tree = useMemo(() => {
    const rootNodes: Record<string, TreeNode> = {};

    customFiles.forEach((file) => {
      let rawPath = file.targetPath ? file.targetPath.replace(/^\/+/, "").replace(/\/+$/, "") : "";
      let parts: string[] = [];
      let filename = file.name;

      if (rawPath) {
        const segments = rawPath.split("/").filter(Boolean);
        if (segments.length > 1) {
          filename = segments.pop() || file.name;
          parts = segments;
        } else if (segments.length === 1) {
          if (file.targetPath.endsWith("/") || !segments[0].includes(".")) {
            parts = [segments[0]];
            filename = file.name;
          } else {
            filename = segments[0];
            parts = [];
          }
        }
      }

      let currentLevel = rootNodes;
      let accPath = "";

      // Ensure intermediate folders exist
      parts.forEach((part) => {
        accPath = accPath ? `${accPath}/${part}` : part;
        if (!currentLevel[part]) {
          currentLevel[part] = {
            id: `folder-${accPath}`,
            name: part,
            type: "folder",
            path: accPath,
            children: [],
            childrenMap: {},
          };
        }
        const node = currentLevel[part];
        if (!node.childrenMap) {
          node.childrenMap = {};
        }
        currentLevel = node.childrenMap;
      });

      // Insert file node
      const filePath = accPath ? `${accPath}/${filename}` : filename;
      currentLevel[filename] = {
        id: file.id,
        name: filename,
        type: "file",
        path: filePath,
        fileItem: file,
      };
    });

    // Convert childrenMap recursively to children array
    const convertNode = (node: TreeNode): TreeNode => {
      if (node.type === "folder") {
        const childNodes = node.childrenMap ? Object.values(node.childrenMap).map(convertNode) : [];
        return {
          id: node.id,
          name: node.name,
          type: "folder",
          path: node.path,
          children: childNodes,
        };
      }
      return node;
    };

    const initialNodes = Object.values(rootNodes).map(convertNode);
    return sortTreeNodes(initialNodes);
  }, [customFiles]);

  const isSearching = searchQuery.trim().length > 0;

  // Filter tree based on search query
  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tree;

    const filterNode = (node: TreeNode): TreeNode | null => {
      if (node.type === "file") {
        const matches = node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
        return matches ? node : null;
      }

      // Folder
      const folderMatches = node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
      const matchingChildren = (node.children || [])
        .map(filterNode)
        .filter((child): child is TreeNode => child !== null);

      if (folderMatches || matchingChildren.length > 0) {
        return {
          ...node,
          children: folderMatches ? (node.children || []) : matchingChildren,
        };
      }

      return null;
    };

    const filtered = tree.map(filterNode).filter((node): node is TreeNode => node !== null);
    return sortTreeNodes(filtered);
  }, [tree, searchQuery]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    const target = itemToDelete;
    setItemToDelete(null);

    const toastId = toast.loading(
      target.type === "folder"
        ? t("editor.fileTree.deletingFolder", { name: target.name })
        : t("editor.fileTree.deletingFile", { name: target.name })
    );

    // Run asynchronously to allow UI modal to close cleanly before batch state update
    setTimeout(() => {
      try {
        if (target.type === "file") {
          removeCustomFile(target.id);
          if (selectedFileId === target.id) {
            onSelectFile(null);
          }
        } else {
          removeCustomFolder(target.path);
          if (selectedFileId) {
            const currentSelected = customFiles.find((f) => f.id === selectedFileId);
            if (currentSelected) {
              const clean = (currentSelected.targetPath || currentSelected.name).replace(/^\/+/, "");
              if (clean === target.path || clean.startsWith(`${target.path}/`)) {
                onSelectFile(null);
              }
            }
          }
        }
        toast.success(
          target.type === "folder"
            ? t("editor.fileTree.deleteFolderSuccess", "Carpeta eliminada correctamente")
            : t("editor.fileTree.deleteFileSuccess", "Archivo eliminado"),
          { id: toastId }
        );
      } catch (err: any) {
        console.error("Failed to delete item:", err);
        toast.error(t("editor.fileTree.deleteError", "Error al eliminar"), { id: toastId });
      }
    }, 20);
  };

  // Import from My Resources
  const handleImportConfigFile = (item: CustomFileItem, overridePath: string) => {
    const cleanPath = overridePath.startsWith("/") ? overridePath : `/${overridePath}`;
    const importedFile: CustomFileItem = {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: item.name,
      targetPath: cleanPath,
      type: item.type,
      content: item.content,
      sourceUrl: item.sourceUrl,
      storageLocation: "local_browser",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addCustomFile(importedFile);
    onSelectFile(importedFile.id);
  };

  const getFileIcon = (filename: string, fileType?: string) => {
    if (fileType) {
      if (fileType === "multimedia") return <Image className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
      if (fileType === "config") return <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      if (fileType === "script") return <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      if (fileType === "data") return <FileJson className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }

    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "json") return <FileJson className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (["js", "ts", "lua", "py", "sh", "zs"].includes(ext || "")) return <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    if (["cfg", "toml", "txt", "ini", "conf", "properties"].includes(ext || "")) {
      return <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    if (["yaml", "yml", "xml", "nbt", "dat"].includes(ext || "")) {
      return <FileJson className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "tiff", "mp4", "webm", "mp3", "wav", "ogg"].includes(ext || "")) {
      return <Image className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    }
    if (["zip", "tar", "gz", "jar"].includes(ext || "")) {
      return <Archive className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  };

  // Recursive tree node renderer
  const renderTreeNodes = (nodes: TreeNode[], level: number = 0) => {
    return nodes.map((node) => {
      const isFolder = node.type === "folder";
      const isExpanded = isSearching ? true : Boolean(expandedFolders[node.path]);
      const isSelected = !isFolder && node.id === selectedFileId;

      return (
        <div key={node.id} className="flex flex-col w-full min-w-0">
          <div 
            className={cn(
              "group flex items-center justify-between px-1.5 py-1 rounded-lg transition-all cursor-pointer select-none text-xs min-w-0",
              isSelected
                ? "bg-muted text-amber-500 border border-amber-500/40 shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
            )}
            onClick={() => {
              if (isFolder) {
                toggleFolder(node.path);
              } else {
                onSelectFile(node.id);
              }
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {isFolder ? (
                <>
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                  )}
                </>
              ) : (
                <>
                  <span className="w-3 shrink-0" />
                  {getFileIcon(node.name, node.fileItem?.type)}
                </>
              )}

              <span 
                className={cn(
                  "truncate font-medium min-w-0",
                  isFolder ? "text-foreground font-semibold" : isSelected ? "text-amber-500 font-semibold" : "text-foreground/90"
                )}
                title={node.name}
              >
                {node.name}
              </span>
            </div>

            {/* Hover Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setItemToDelete({
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    path: node.path,
                  });
                }}
                title={isFolder ? t("editor.fileTree.deleteFolder") : t("editor.fileTree.deleteFile")}
                className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Children if folder is expanded */}
          {isFolder && isExpanded && node.children && node.children.length > 0 && (
            <div className="flex flex-col mt-0.5 min-w-0 ml-[12px] pl-1.5 border-l border-border hover:border-border/80 transition-colors">
              {renderTreeNodes(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div 
      className="relative flex flex-col gap-4 w-full min-w-0 overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Over Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 rounded-2xl bg-background/90 backdrop-blur-sm border-2 border-dashed border-amber-400 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 pointer-events-none">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mb-3">
            <FolderUp className="w-6 h-6 text-amber-500 animate-bounce" />
          </div>
          <p className="text-sm font-bold text-foreground">
            {t("editor.fileTree.dropToUpload", "Suelta las carpetas o archivos aquí")}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {t("editor.fileTree.dropToUploadDesc", "Se importarán manteniendo su jerarquía de directorios")}
          </p>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="flex flex-col gap-2.5 bg-muted dark:bg-[#1E1E1E] p-3.5 rounded-2xl border border-border">
        <div className="flex items-center justify-between pl-1 pr-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            {t("editor.fileTree.customFiles")}
          </span>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col gap-2 mt-0.5">
          <Button
            onClick={() => onOpenAddDialog()}
            className="w-full bg-amber-400 hover:bg-amber-300 text-black rounded-xl h-10 px-4 text-xs font-semibold gap-2 border-0 active:scale-95 transition-all duration-200 cursor-pointer shadow-none"
          >
            <Plus className="w-4 h-4" />
            <span>{t("editor.fileTree.addCustomFile")}</span>
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={() => folderInputRef.current?.click()}
                    className="w-full h-9 text-xs font-semibold text-muted-foreground hover:text-amber-500 hover:bg-muted rounded-xl px-2 gap-1.5 border border-border transition-all cursor-pointer truncate"
                  >
                    <FolderUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">{t("editor.fileTree.uploadFolder")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs shadow-xl z-50">
                  {t("editor.fileTree.uploadFolder")}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={() => setIsImportDialogOpen(true)}
                    className="w-full h-9 text-xs font-semibold text-muted-foreground hover:text-amber-500 hover:bg-muted rounded-xl px-2 gap-1.5 border border-border transition-all cursor-pointer truncate"
                  >
                    <Library className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">{t("editor.fileTree.myResources")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs shadow-xl z-50">
                  {t("editor.fileTree.myResources")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is standard in browsers but not in React HTMLAttributes
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFolderInputSelect}
          />
        </div>
      </div>

      {/* Search Bar */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("editor.fileTree.searchPlaceholder")}
        label={t("editor.fileTree.search")}
      />

      {/* Directory Explorer Header */}
      <div className="flex items-center justify-between pl-1 pr-1 pt-1">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          {t("editor.fileTree.directoryExplorer")}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">/</span>
      </div>

      {/* Tree Node Hierarchy */}
      <div className="flex flex-col gap-0.5 w-full min-w-0 overflow-hidden">
        {isSearching && filteredTree.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Search className="w-5 h-5 text-muted-foreground/40" />
            <span>{t("editor.fileTree.noFilesFound")}</span>
            <span className="text-[11px] text-muted-foreground/60">{t("editor.fileTree.noFilesMatch", { query: searchQuery })}</span>
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Folder className="w-6 h-6 text-muted-foreground/40" />
            <span>{t("editor.fileTree.directoryEmpty")}</span>
            <span className="text-[11px] text-muted-foreground/60">{t("editor.fileTree.directoryEmptyDesc")}</span>
          </div>
        ) : (
          renderTreeNodes(filteredTree)
        )}
      </div>

      {/* Import from My Resources Dialog */}
      <ImportConfigFileDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={handleImportConfigFile}
      />

      {/* Delete Confirmation Dialog */}
      {itemToDelete && (
        <DeleteConfirmDialog
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={handleConfirmDelete}
          title={itemToDelete.type === "folder" ? t("editor.fileTree.deleteFolderTitle") : t("editor.fileTree.deleteFileTitle")}
          itemName={itemToDelete.name}
          description={itemToDelete.type === "folder" ? t("editor.fileTree.deleteFolderDesc", { name: itemToDelete.name }) : undefined}
        />
      )}
    </div>
  );
}
