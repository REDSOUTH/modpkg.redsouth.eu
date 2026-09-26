import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Settings, Trash2, ArrowRight, Layers, Tag, FileText } from "lucide-react";
import { PackSettings } from "@/types";
import { usePack } from "@/context/pack-context";
import { getPackData } from "@/lib/storage/package-storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/common/delete-confirm-dialog";
import { ActionButton } from "@/components/common/action-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

interface ModpkgCardProps {
  pack: PackSettings;
  isActive: boolean;
  onOpenSettings: (pack: PackSettings) => void;
}

export function ModpkgCard({ pack, isActive, onOpenSettings }: ModpkgCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { switchPack, deletePack } = usePack();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTitleHovered, setIsTitleHovered] = useState(false);

  // Read package data to get installed items & custom files count
  const packData = getPackData(pack.id);
  const curVer = pack.currentVersion || "v1.0.0";
  const releaseData = packData.releases?.[curVer];
  const itemsCount = releaseData?.installedContent?.length ?? packData.installedContent?.length ?? 0;
  const filesCount = releaseData?.customFiles?.length ?? packData.customFiles?.length ?? 0;
  const totalVersions = pack.versions?.length || 1;

  const handleOpenInEditor = () => {
    switchPack(pack.id);
    navigate("/editor");
  };

  const handleDelete = () => {
    deletePack(pack.id);
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <div 
        className={`group relative flex flex-col justify-between rounded-2xl p-5 transition-[outline,outline-offset,box-shadow,background-color] duration-150 overflow-hidden bg-card dark:bg-[#1E1E1E] ${
          isActive 
            ? "outline outline-3 outline-[#FE5000] shadow-lg shadow-[#FE5000]/10" 
            : "outline outline-3 outline-transparent hover:outline-[#FE5000] hover:outline-offset-4 shadow-sm dark:shadow-none"
        }`}
      >
        {/* Top bar: Icon, Titles & Status */}
        <div className="flex items-start gap-3.5">
          {/* Pack Icon / Avatar */}
          <div 
            onClick={handleOpenInEditor}
            onMouseEnter={() => setIsTitleHovered(true)}
            onMouseLeave={() => setIsTitleHovered(false)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              isActive 
                ? "bg-[#FE5000]/15 text-[#FE5000]" 
                : "bg-muted dark:bg-black text-muted-foreground border border-border/50 dark:border-white/5"
            }`}
          >
            <Package className="w-6 h-6" />
          </div>

          {/* Name, version and ID */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div 
                className="flex items-center gap-1.5 cursor-pointer min-w-0 max-w-full"
                onClick={handleOpenInEditor}
                onMouseEnter={() => setIsTitleHovered(true)}
                onMouseLeave={() => setIsTitleHovered(false)}
              >
                <h3 
                  className={`font-bold text-base leading-tight truncate transition-colors ${
                    isTitleHovered ? "text-[#FE5000]" : "text-foreground"
                  }`} 
                  title={pack.name}
                >
                  {pack.name}
                </h3>
                <ArrowRight 
                  className={`w-3.5 h-3.5 text-[#FE5000] transition-all shrink-0 ${
                    isTitleHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
                  }`} 
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
              <span className="text-[#FE5000]">{pack.currentVersion || "v1.0.0"}</span>
              <span>·</span>
              <span className="truncate">{pack.id}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 mt-3 leading-relaxed min-h-[32px]">
          {pack.description || t("library.card.noDescription")}
        </p>

        {/* Metadata Badges & Counters without separator above */}
        <div className="flex items-center gap-2 flex-wrap mt-4 text-xs">
          {/* Loader badge matching content cards exactly (no hover) */}
          <Badge 
            variant="secondary" 
            className="bg-muted dark:bg-black text-muted-foreground rounded-md text-[10px] uppercase tracking-wider font-medium border border-border/50 dark:border-white/5 select-none cursor-default"
          >
            {pack.loader}
          </Badge>

          {/* MC Version badge matching content cards exactly (no hover) */}
          <Badge 
            variant="secondary" 
            className="bg-muted dark:bg-black text-muted-foreground rounded-md text-[10px] uppercase tracking-wider font-medium border border-border/50 dark:border-white/5 select-none cursor-default font-mono"
          >
            {pack.mcVersion}
          </Badge>
          
          {/* Content & Versions Counter: versions first, then contents with layers icon, then files, separated by · */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto select-none">
            {/* 1. Versiones primero con icono */}
            <div className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>
                {totalVersions}{" "}
                {totalVersions === 1
                  ? t("library.card.version_one")
                  : t("library.card.version_other")}
              </span>
            </div>
            
            <span className="text-muted-foreground/60 font-semibold">·</span>
            
            {/* 2. Contenidos agregados con el icono de Layers */}
            <div className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-[#FE5000] shrink-0" />
              <span>
                {itemsCount}{" "}
                {itemsCount === 1
                  ? t("library.card.content_one")
                  : t("library.card.content_other")}
              </span>
            </div>

            {/* 3. Archivos personalizados si existen */}
            {filesCount > 0 && (
              <>
                <span className="text-muted-foreground/60 font-semibold">·</span>
                <div className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {filesCount}{" "}
                    {filesCount === 1
                      ? t("library.card.file_one")
                      : t("library.card.file_other")}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons with visible separator */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border dark:border-[#333333]">
          {/* Settings Button */}
          <ActionButton
            color="zinc"
            icon={<Settings className="w-3.5 h-3.5" />}
            label={t("library.card.settings")}
            tooltip={t("library.card.settingsTooltip")}
            onClick={() => onOpenSettings(pack)}
          />

          {/* Delete Button matching table style with 2px orange border */}
          <ActionButton
            color="orange"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            tooltip={t("library.card.delete")}
            onClick={() => setIsDeleteDialogOpen(true)}
          />

          {/* Primary Action: Go to Editor */}
          <Button
            size="sm"
            onClick={handleOpenInEditor}
            className="h-9 ml-auto px-4 rounded-xl bg-[#FE5000] hover:bg-[#e04700] text-white font-medium text-xs shadow-sm shadow-[#FE5000]/20 flex items-center gap-1.5 cursor-pointer"
          >
            <span>{isActive ? t("library.card.continueInEditor") : t("library.card.openInEditor")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Confirm delete dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title={`Delete "${pack.name}"?`}
        description="This will permanently delete this MODPKG and all its installed content, custom files, and configuration versions from your browser storage. This action cannot be undone."
      />
    </>
  );
}
