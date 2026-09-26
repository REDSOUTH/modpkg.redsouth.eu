import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomContentItem, CustomFileItem, InstalledItem } from "@/types";
import { ContentTypeBadge, FileTypeBadge, ContentTypeIcon } from "@/components/common/content-type-icon";
import { StorageBadge } from "@/components/common/storage-badge";
import { Pencil, Trash2, Plus, Globe, Code2, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PackageDropdownSelector } from "@/components/common/package-dropdown-selector";
import { ActionButton } from "@/components/common/action-button";
import { DeleteConfirmDialog } from "@/components/common/delete-confirm-dialog";
import { PathCopyBox } from "@/components/common/path-copy-box";
import { getPackData, savePackData } from "@/lib/storage/package-storage";
import { usePack } from "@/context/pack-context";

export interface ResourcesTableProps {
  mode: "custom-content" | "custom-file";
  items: (CustomContentItem | CustomFileItem)[];
  accentColor?: "blue" | "amber";
  onDelete: (id: string) => void;
  onEdit: (item: any) => void;
}

export function ResourcesTable({
  mode,
  items,
  onDelete,
  onEdit,
}: ResourcesTableProps) {
  const { t } = useTranslation();
  const { packSettings, addContent, removeContent, addCustomFile, removeCustomFile } = usePack();
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [, setForceUpdate] = useState<number>(0);

  const isContentMode = mode === "custom-content";

  // Helper for badge overflow in Custom Content
  const renderBadgeOverflow = (value: string | undefined, defaultLabel: string) => {
    if (!value || value === "Any") {
      return (
        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-muted dark:bg-[#1E1E1E] text-muted-foreground">
          {defaultLabel}
        </span>
      );
    }
    const badges = value.split(",").map((s) => s.trim()).filter(Boolean);
    const visibleBadges = badges.slice(0, 2);
    const hiddenCount = badges.length - visibleBadges.length;

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {visibleBadges.map((b) => (
          <span key={b} className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted dark:bg-[#1E1E1E] text-foreground">
            {b}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span className="inline-block px-2 py-1 rounded-lg text-xs font-bold bg-muted dark:bg-[#1E1E1E] text-muted-foreground" title={badges.join(", ")}>
            +{hiddenCount}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="w-full overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <th className="py-4 px-6 min-w-[240px]">{t("myResources.table.name")}</th>
              {isContentMode ? (
                <>
                  <th className="py-4 px-4 min-w-[130px]">{t("myResources.table.contentType")}</th>
                  <th className="py-4 px-4 min-w-[150px]">{t("myResources.table.loaders")}</th>
                  <th className="py-4 px-4 min-w-[150px]">{t("myResources.table.versions")}</th>
                  <th className="py-4 px-4 min-w-[170px]">{t("myResources.table.storage")}</th>
                  <th className="py-4 px-4 min-w-[200px]">{t("myResources.table.directDownload")}</th>
                </>
              ) : (
                <>
                  <th className="py-4 px-4 min-w-[120px]">{t("myResources.table.fileType")}</th>
                  <th className="py-4 px-4 min-w-[110px]">{t("myResources.table.content")}</th>
                  <th className="py-4 px-4 min-w-[170px]">{t("myResources.table.storage")}</th>
                  <th className="py-4 px-4 min-w-[200px]">{t("myResources.table.targetPath")}</th>
                </>
              )}
              <th className="py-4 px-6 text-right min-w-[180px]">{t("myResources.table.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {items.map((item) => {
              const contentItem = isContentMode ? (item as CustomContentItem) : null;
              const fileItem = !isContentMode ? (item as CustomFileItem) : null;

              return (
                <tr
                  key={item.id}
                  className="hover:bg-muted/40 transition-colors"
                >
                  {/* 1. Name Column with Neutral Dark/Grey Icon Box */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-muted/70 dark:bg-[#1E1E1E] border border-border">
                        <ContentTypeIcon type={contentItem ? contentItem.contentType : fileItem ? fileItem.type : "mod"} />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-bold text-sm text-foreground transition-colors truncate max-w-[200px]">
                          {item.name}
                        </span>
                        {contentItem && (
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{t("myResources.table.byAuthor", { author: contentItem.author || t("myResources.table.unknownAuthor") })}</span>
                            {contentItem.targetPath && (
                              <span className="font-mono text-[11px] text-muted-foreground/80">
                                ({contentItem.targetPath})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Mode Specific Columns */}
                  {isContentMode && contentItem ? (
                    <>
                      {/* Content Type */}
                      <td className="py-4 px-4">
                        <ContentTypeBadge type={contentItem.contentType} />
                      </td>
                      {/* Loaders */}
                      <td className="py-4 px-4">
                        {renderBadgeOverflow(contentItem.loader, t("myResources.table.allLoaders"))}
                      </td>
                      {/* Versions */}
                      <td className="py-4 px-4">
                        {renderBadgeOverflow(contentItem.mcVersion, t("myResources.table.allVersions"))}
                      </td>
                      {/* Storage */}
                      <td className="py-4 px-4">
                        <StorageBadge storageType={item.storageLocation} />
                      </td>
                      {/* Direct Download (with PathCopyBox + Open Link) */}
                      <td className="py-4 px-4">
                        <PathCopyBox value={contentItem.downloadUrl} showOpenLink={true} />
                      </td>
                    </>
                  ) : fileItem ? (
                    <>
                      {/* 2. File Type */}
                      <td className="py-4 px-4">
                        <FileTypeBadge type={fileItem.type} />
                      </td>
                      {/* 3. Content */}
                      <td className="py-4 px-4">
                        {fileItem.sourceUrl ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-400/10 text-amber-400">
                            <Globe className="w-3 h-3" />
                            {t("myResources.table.contentUrl")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted dark:bg-[#1E1E1E] text-muted-foreground">
                            <Code2 className="w-3 h-3" />
                            {t("myResources.table.contentInline")}
                          </span>
                        )}
                      </td>
                      {/* 4. Storage */}
                      <td className="py-4 px-4">
                        <StorageBadge storageType={item.storageLocation} />
                      </td>
                      {/* 5. Target Path (with PathCopyBox, copy button only) */}
                      <td className="py-4 px-4">
                        <PathCopyBox value={fileItem.targetPath} showOpenLink={false} />
                      </td>
                    </>
                  ) : null}

                  {/* Actions Column */}
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {/* Add to Package Dropdown Selector */}
                      <PackageDropdownSelector
                        mode="add-to-pack"
                        align="right"
                        itemCompatibility={contentItem ? {
                          mcVersion: contentItem.mcVersion,
                          loader: contentItem.loader,
                        } : undefined}
                        checkIsItemInPack={(packId) => {
                          const packData = getPackData(packId);
                          if (contentItem) {
                            return packData.installedContent.some((i) => i.id === contentItem.id);
                          }
                          if (fileItem) {
                            return packData.customFiles.some((f) => f.id === fileItem.id);
                          }
                          return false;
                        }}
                        trigger={(isOpen) => (
                          <button
                            type="button"
                            className={`group/addbtn h-8 px-3 rounded-xl border-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                              isOpen
                                ? "border-[#FE5000] bg-transparent text-[#FE5000]"
                                : "border-border bg-muted dark:bg-[#1E1E1E] text-muted-foreground hover:border-[#FE5000] hover:bg-transparent hover:text-[#FE5000]"
                            }`}
                          >
                            <Plus className={`w-3.5 h-3.5 transition-colors ${isOpen ? "text-[#FE5000]" : "text-muted-foreground group-hover/addbtn:text-[#FE5000]"}`} />
                            <span className={`transition-colors font-semibold text-xs ${isOpen ? "text-[#FE5000]" : "text-foreground group-hover/addbtn:text-[#FE5000]"}`}>
                              {t("myResources.table.addToPackage")}
                            </span>
                            <ChevronDown className={`w-3 h-3 transition-all duration-200 ml-0.5 ${isOpen ? "rotate-180 text-[#FE5000]" : "text-muted-foreground group-hover/addbtn:text-[#FE5000]"}`} />
                          </button>
                        )}
                        onSelectPack={(targetPack, isCurrentlyAdded) => {
                          const packData = getPackData(targetPack.id);
                          if (contentItem) {
                            if (isCurrentlyAdded) {
                              packData.installedContent = packData.installedContent.filter((i) => i.id !== contentItem.id);
                              savePackData(targetPack.id, packData);
                              if (targetPack.id === packSettings.id) {
                                removeContent(contentItem.id);
                              }
                            } else {
                              const installedItem: InstalledItem = {
                                id: contentItem.id,
                                name: contentItem.name,
                                provider: "custom",
                                iconUrl: "",
                                versionId: "custom",
                                versionName: "Custom URL",
                                contentType: contentItem.contentType,
                                downloadUrl: contentItem.downloadUrl,
                                author: contentItem.author,
                                mcVersion: contentItem.mcVersion,
                                loader: contentItem.loader,
                                targetPath: contentItem.targetPath,
                                storageLocation: contentItem.storageLocation,
                              };
                              packData.installedContent = [installedItem, ...packData.installedContent.filter((i) => i.id !== contentItem.id)];
                              savePackData(targetPack.id, packData);
                              if (targetPack.id === packSettings.id) {
                                addContent(installedItem);
                              }
                            }
                          } else if (fileItem) {
                            if (isCurrentlyAdded) {
                              packData.customFiles = packData.customFiles.filter((f) => f.id !== fileItem.id);
                              savePackData(targetPack.id, packData);
                              if (targetPack.id === packSettings.id) {
                                removeCustomFile(fileItem.id);
                              }
                            } else {
                              packData.customFiles = [fileItem, ...(packData.customFiles || []).filter((f) => f.id !== fileItem.id)];
                              savePackData(targetPack.id, packData);
                              if (targetPack.id === packSettings.id) {
                                addCustomFile(fileItem);
                              }
                            }
                          }
                          setForceUpdate((v) => v + 1);
                        }}
                      />

                      {/* Tooltip Wrapped Edit & Delete Buttons */}
                      <ActionButton
                        size="sm"
                        color="blue"
                        icon={<Pencil className="w-3.5 h-3.5" />}
                        tooltip={t("myResources.table.editResource")}
                        onClick={() => onEdit(item)}
                      />

                      <ActionButton
                        size="sm"
                        color="red"
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        tooltip={t("myResources.table.deleteResource")}
                        onClick={() => setItemToDelete({ id: item.id, name: item.name })}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <DeleteConfirmDialog
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={() => {
            if (itemToDelete) {
              onDelete(itemToDelete.id);
            }
          }}
          title={isContentMode ? t("myResources.table.deleteContentTitle") : t("myResources.table.deleteFileTitle")}
          itemName={itemToDelete.name}
        />
      )}
    </>
  );
}
