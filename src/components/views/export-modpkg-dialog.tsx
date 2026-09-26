import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/common/action-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  FileJson,
  FileCode2,
  Archive,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileSliders,
  Layers,
  X,
} from "lucide-react";
import { ContentTypeIcon } from "@/components/common/content-type-icon";
import { ProviderIcon } from "@/components/common/provider-icon";
import { usePack } from "@/context/pack-context";
import { useTranslation, Trans } from "react-i18next";
import {
  downloadModpkgIndexFile,
  downloadModpkgProjectFile,
  getSafePackageId,
} from "@/functions/export-package";
import {
  exportModpkgZip,
  ZipExportProgress,
  FailedItemReport,
} from "@/functions/export-zip";
import notification from "@/functions/notification";

export interface ExportModpkgDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModpkgDialog({ isOpen, onClose }: ExportModpkgDialogProps) {
  const { t } = useTranslation();
  const { packSettings, installedContent, customFiles, verifiedItems, setVerifiedItems } = usePack();

  // ZIP options
  const [includeIndexInZip, setIncludeIndexInZip] = useState<string>("yes");
  const [includeProjectInZip, setIncludeProjectInZip] = useState<string>("no");

  // ZIP export state
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<ZipExportProgress | null>(null);
  const [failedItems, setFailedItems] = useState<FailedItemReport[]>([]);
  const [exportCompleted, setExportCompleted] = useState(false);

  const safeId = getSafePackageId(packSettings);
  const totalContentCount = installedContent.length;
  const totalCustomFilesCount = customFiles.length;

  const handleExportIndex = () => {
    try {
      downloadModpkgIndexFile(packSettings, installedContent, customFiles);
      notification.default(t("exportDialog.exportedIndex", { file: `${safeId}.mpkg` }));
    } catch (err: any) {
      notification.warn(t("exportDialog.exportIndexFailed", { error: err.message }));
    }
  };

  const handleExportProject = () => {
    try {
      downloadModpkgProjectFile(packSettings, installedContent, customFiles);
      notification.default(t("exportDialog.exportedProject", { file: `${safeId}.mpkg-proj` }));
    } catch (err: any) {
      notification.warn(t("exportDialog.exportProjectFailed", { error: err.message }));
    }
  };

  const handleBuildZip = async () => {
    setIsExportingZip(true);
    setExportCompleted(false);
    setFailedItems([]);
    setZipProgress({
      percentage: 0,
      currentStep: t("exportDialog.initializing"),
      completedItems: 0,
      totalItems: totalContentCount + totalCustomFilesCount + 2,
    });

    try {
      const result = await exportModpkgZip(packSettings, installedContent, customFiles, {
        includeVersionIndex: includeIndexInZip === "yes",
        includeProjectFile: includeProjectInZip === "yes",
        verifiedItemIds: verifiedItems,
        onProgress: (progress) => {
          setZipProgress(progress);
        },
      });

      // Synchronize export results back to sidebar verification
      if (result.compatibleItemIds && result.compatibleItemIds.length > 0) {
        setVerifiedItems(prev => Array.from(new Set([...prev, ...result.compatibleItemIds])));
      }

      setExportCompleted(true);
      if (result.failedItems.length > 0) {
        setFailedItems(result.failedItems);
        notification.warn(
          t("exportDialog.failedItemsNotice", { count: result.failedItems.length })
        );
      } else {
        notification.default(t("exportDialog.packageSuccess", { file: result.fileName }));
      }
    } catch (err: any) {
      console.error("ZIP packaging error:", err);
      notification.warn(t("exportDialog.generateZipFailed", { error: err.message || "Unknown error" }));
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isExportingZip && !open && onClose()}>
      <DialogContent
        hideClose
        className="w-[95vw] max-w-[850px] bg-card border border-border p-0 gap-0 overflow-hidden shadow-2xl rounded-2xl text-foreground"
      >
        {/* Header matching Create New MODPKG with centered large custom close button */}
        <DialogHeader className="p-5 px-6 border-b border-border flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-[#FE5000] shrink-0" />
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">{t("exportDialog.title")}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("exportDialog.subtitle", {
                  name: packSettings.name || "Modpack",
                  version: packSettings.currentVersion || "v1.0.0",
                  mcVersion: packSettings.mcVersion,
                  loader: packSettings.loader
                })}
              </p>
            </div>
          </div>
          <DialogClose asChild disabled={isExportingZip}>
            <button
              title={t("common.close")}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </DialogHeader>

        {/* Body Content */}
        <ScrollArea className="max-h-[82vh] overflow-y-auto">
          <div className="p-6 flex flex-col gap-5">

            {/* 1. Content Summary Section (no base border) */}
            <div className="flex flex-col gap-3 p-4 bg-muted/40 dark:bg-[#1E1E1E] border border-border/50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("exportDialog.selectedContents")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted dark:bg-[#2A2A2A] text-muted-foreground font-medium">
                    {t("exportDialog.itemsCount", { count: totalContentCount })}
                  </span>
                  {totalCustomFilesCount > 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 flex items-center gap-1 font-medium">
                      <FileSliders className="w-3 h-3" />
                      {t("exportDialog.overridesCount", { count: totalCustomFilesCount })}
                    </span>
                  )}
                </div>
              </div>

              {/* Items Grid with Tooltips (no hover border) */}
              {totalContentCount === 0 && totalCustomFilesCount === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  {t("exportDialog.emptyContents")}
                </p>
              ) : (
                <TooltipProvider delayDuration={150}>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {installedContent.map((item) => (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>
                          <div className="w-9 h-9 rounded-lg bg-card dark:bg-[#2A2A2A] border border-border flex items-center justify-center relative overflow-hidden cursor-pointer shrink-0">
                            {item.iconUrl && item.iconUrl !== "/logo.svg" ? (
                              <img
                                src={item.iconUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <ContentTypeIcon type={item.contentType} iconClassName="w-4 h-4 text-muted-foreground" />
                            )}
                            <div className="absolute bottom-0 right-0 p-0.5 bg-background/80 rounded-tl">
                              <ProviderIcon provider={item.provider} className="w-2.5 h-2.5" />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs p-2.5 shadow-xl max-w-xs">
                          <p className="font-semibold text-white">{item.name}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                            <span className="capitalize">{item.contentType}</span>
                            <span>•</span>
                            <span className="capitalize">{item.provider}</span>
                            <span>•</span>
                            <span className="text-[#FE5000]">
                              {item.versionName || (item.versionId === "latest" ? t("editor.card.latest") : item.versionId === "latest-unstable" ? t("editor.card.latestUnstable") : item.versionId)}
                            </span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}

                    {/* Custom Files / Overrides icons (no hover border) */}
                    {customFiles.map((file) => (
                      <Tooltip key={file.id}>
                        <TooltipTrigger asChild>
                          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center overflow-hidden cursor-pointer shrink-0">
                            <FileSliders className="w-4 h-4 text-amber-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs p-2.5 shadow-xl">
                          <p className="font-semibold text-amber-500">{file.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{t("exportDialog.target", { path: file.targetPath })}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">{t("exportDialog.type", { type: file.type })}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              )}
            </div>

            {/* 2. Fast JSON Exports Row (no background on icons, in same line with title, no hover on containers) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Version Index JSON Card */}
              <div className="flex flex-col justify-between p-4 bg-muted/40 dark:bg-[#1E1E1E] border border-border/50 rounded-xl gap-4">
                <div className="flex flex-col text-left gap-1.5">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-sky-500 shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground">{t("exportDialog.versionIndexTitle")}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <Trans i18nKey="exportDialog.versionIndexDesc" values={{ file: `${safeId}.mpkg` }}>
                      Exports <code className="text-foreground bg-muted dark:bg-[#2A2A2A] px-1 py-0.5 rounded text-[11px]">{`${safeId}.mpkg`}</code> with the current release manifest, dependencies and overrides.
                    </Trans>
                  </p>
                </div>
                <ActionButton
                  onClick={handleExportIndex}
                  disabled={isExportingZip}
                  fullWidth
                  color="zinc"
                  icon={<Download className="w-3.5 h-3.5" />}
                  label={t("exportDialog.exportIndexBtn")}
                />
              </div>

              {/* Project File JSON Card */}
              <div className="flex flex-col justify-between p-4 bg-muted/40 dark:bg-[#1E1E1E] border border-border/50 rounded-xl gap-4">
                <div className="flex flex-col text-left gap-1.5">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground">{t("exportDialog.projectFileTitle")}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <Trans i18nKey="exportDialog.projectFileDesc" values={{ file: `${safeId}.mpkg-proj` }}>
                      Exports <code className="text-foreground bg-muted dark:bg-[#2A2A2A] px-1 py-0.5 rounded text-[11px]">{`${safeId}.mpkg-proj`}</code> containing full project data, releases history and settings.
                    </Trans>
                  </p>
                </div>
                <ActionButton
                  onClick={handleExportProject}
                  disabled={isExportingZip}
                  fullWidth
                  color="zinc"
                  icon={<Download className="w-3.5 h-3.5" />}
                  label={t("exportDialog.exportProjectBtn")}
                />
              </div>

            </div>

            {/* 3. Featured Real ZIP Package Builder (solid MODPKG orange border without opacity) */}
            <div className="flex flex-col p-5 bg-muted/40 dark:bg-[#1E1E1E] border-2 border-[#FE5000] rounded-xl gap-5 relative overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col text-left gap-1.5">
                  <div className="flex items-center gap-2">
                    <Archive className="w-5 h-5 text-[#FE5000] shrink-0" />
                    <h3 className="text-sm font-bold text-foreground">{t("exportDialog.zipTitle")}</h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#FE5000] text-white">
                      {t("exportDialog.fullBundle")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("exportDialog.zipDesc")}
                  </p>
                </div>
              </div>

              {/* ZIP Inclusion Selects (no outer border) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 dark:bg-[#141414] border border-border/50 rounded-xl">
                {/* Select 1: Include Version Index */}
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t("exportDialog.includeIndex")}
                  </label>
                  <Select
                    value={includeIndexInZip}
                    onValueChange={setIncludeIndexInZip}
                    disabled={isExportingZip}
                  >
                    <SelectTrigger className="bg-muted/70 dark:bg-[#1E1E1E] border-2 border-border text-foreground focus:ring-0 focus:border-[#FE5000] text-xs h-9 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover dark:bg-[#1E1E1E] border-2 border-border text-popover-foreground rounded-xl">
                      <SelectItem value="yes" className="text-xs focus:bg-muted dark:focus:bg-[#262626] focus:text-[#FE5000]">
                        {t("exportDialog.includeIndexYes")}
                      </SelectItem>
                      <SelectItem value="no" className="text-xs focus:bg-muted dark:focus:bg-[#262626] focus:text-[#FE5000]">
                        {t("exportDialog.no")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Select 2: Include Full Project File */}
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t("exportDialog.includeProject")}
                  </label>
                  <Select
                    value={includeProjectInZip}
                    onValueChange={setIncludeProjectInZip}
                    disabled={isExportingZip}
                  >
                    <SelectTrigger className="bg-muted/70 dark:bg-[#1E1E1E] border-2 border-border text-foreground focus:ring-0 focus:border-[#FE5000] text-xs h-9 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover dark:bg-[#1E1E1E] border-2 border-border text-popover-foreground rounded-xl">
                      <SelectItem value="yes" className="text-xs focus:bg-muted dark:focus:bg-[#262626] focus:text-[#FE5000]">
                        {t("exportDialog.includeProjectYes")}
                      </SelectItem>
                      <SelectItem value="no" className="text-xs focus:bg-muted dark:focus:bg-[#262626] focus:text-[#FE5000]">
                        {t("exportDialog.includeProjectNo")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Real-time Progress Section */}
              {isExportingZip && zipProgress && (
                <div className="flex flex-col gap-2.5 p-4 bg-card dark:bg-[#141414] border border-border rounded-xl">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FE5000]" />
                      <span className="font-medium text-foreground truncate max-w-[320px]">
                        {zipProgress.currentStep}
                      </span>
                    </div>
                    <span className="font-bold text-[#FE5000]">{zipProgress.percentage}%</span>
                  </div>
                  <Progress value={zipProgress.percentage} className="h-2 bg-muted" />
                </div>
              )}

              {/* Warning reports if any item failed to download */}
              {failedItems.length > 0 && (
                <div className="flex flex-col gap-2 p-3 bg-amber-500/10 rounded-xl text-left">
                  <div className="flex items-center gap-2 text-amber-500 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{t("exportDialog.failedItemsTitle", { count: failedItems.length })}</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto flex flex-col gap-1 pl-6 text-[11px] text-muted-foreground">
                    {failedItems.map((fi, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="text-foreground truncate">• {fi.name} ({fi.provider})</span>
                        <span className="text-muted-foreground shrink-0">{fi.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success Badge */}
              {exportCompleted && failedItems.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-xl text-emerald-500 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t("exportDialog.packageDownloaded", { file: `${safeId}.mpkg.zip` })}</span>
                </div>
              )}

              {/* Build Button styled exactly like the opening button */}
              <button
                onClick={handleBuildZip}
                disabled={isExportingZip || (totalContentCount === 0 && totalCustomFilesCount === 0)}
                className="h-12 flex items-center justify-center bg-[#FE5000] hover:bg-[#E04700] text-white font-semibold rounded-xl transition-all outline outline-2 outline-transparent hover:outline-[#FE5000] hover:outline-offset-[3px] active:scale-95 duration-200 overflow-hidden cursor-pointer w-full gap-2 disabled:opacity-50 disabled:pointer-events-none border-0 dark:border-0"
              >
                {isExportingZip ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t("exportDialog.buildingZip")}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 flex-shrink-0" />
                    <span>{t("exportDialog.buildDownloadBtn")}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
export default ExportModpkgDialog;
