import { CardContentType, CardProviderType, ModItemData } from "@/pages/editor/components/mod-card";
import { ModVersion } from "@/types";
import { MODRINTH_PROJECT_TYPES, CURSEFORGE_CLASS_IDS } from "./categories";
import { getCurseforgeProxyUrl } from "./curseforge";

// For modrinth sort string
const modrinthSortMap: Record<string, string> = {
  relevance: "relevance",
  downloads: "downloads",
  updated: "updated",
  newest: "newest"
};

// For curseforge sortField int
// 1=Featured, 2=Popularity, 3=LastUpdated, 4=Name, 6=TotalDownloads, 11=ReleasedDate
const curseforgeSortMap: Record<string, number | undefined> = {
  relevance: undefined, // Handled dynamically based on query
  downloads: 6,
  updated: 3,
  newest: 11
};

export async function searchMods(
  query: string,
  provider: string,
  contentType: string,
  selectedCategories: string[],
  selectedEnvironments: string[],
  sortBy: string,
  limit: number = 20,
  offset: number = 0,
  mcVersion?: string,
  loader?: string
): Promise<ModItemData[]> {
  // If "all" and worlds, override provider to curseforge
  if (provider === "all" && contentType === "worlds") {
    provider = "curseforge";
  }

  const fetchModrinth = provider === "all" || provider === "modrinth";
  const fetchCurseForge = provider === "all" || provider === "curseforge";

  const [modrinthRes, cfRes] = await Promise.all([
    fetchModrinth ? searchModrinth(query, contentType, selectedCategories, selectedEnvironments, sortBy, limit, offset, mcVersion, loader) : Promise.resolve([]),
    fetchCurseForge ? searchCurseForge(query, contentType, selectedCategories, selectedEnvironments, sortBy, limit, offset, mcVersion, loader) : Promise.resolve([])
  ]);

  if (provider === "modrinth") return modrinthRes;
  if (provider === "curseforge") return cfRes;

  // Unify for "all"
  // Modrinth is primary.
  const unified = [...modrinthRes];
  
  for (const cfMod of cfRes) {
    // Check if it already exists in Modrinth by exact name (case-insensitive)
    const existingIndex = unified.findIndex(m => m.name.toLowerCase() === cfMod.name.toLowerCase());
    if (existingIndex >= 0) {
      // It exists in Modrinth. Mark it as 'all' and attach the CF ID.
      unified[existingIndex].provider = "all";
      unified[existingIndex].curseforgeId = cfMod.curseforgeId;
    } else {
      // It's only on CurseForge
      unified.push(cfMod);
    }
  }

  return unified;
}

async function searchModrinth(
  query: string, 
  contentType: string, 
  categories: string[], 
  envs: string[], 
  sortBy: string,
  limit: number,
  offset: number,
  mcVersion?: string,
  loader?: string
): Promise<ModItemData[]> {
  const projectType = MODRINTH_PROJECT_TYPES[contentType] || "mod";
  const index = modrinthSortMap[sortBy] || "relevance";
  
  // Build facets
  const facets: string[][] = [];
  facets.push([`project_type:${projectType}`]);
  
  // For shaders, Modrinth shaders are version & loader agnostic (OptiFine/Iris/Sodium across versions)
  if (mcVersion && projectType !== "shader") {
    facets.push([`versions:${mcVersion}`]);
  }
  
  if (loader && projectType === "mod") {
    facets.push([`categories:${loader.toLowerCase()}`]);
  }

  if (categories.length > 0) {
    const catFacets = categories.map(c => `categories:${c.toLowerCase()}`);
    facets.push(catFacets); // OR logic within the array
  }
  
  // Environment facets
  if (envs.includes("client") && !envs.includes("server")) {
    facets.push(["client_side:required", "client_side:optional"]);
  } else if (envs.includes("server") && !envs.includes("client")) {
    facets.push(["server_side:required", "server_side:optional"]);
  }

  const url = new URL("https://api.modrinth.com/v2/search");
  if (query) url.searchParams.set("query", query);
  url.searchParams.set("index", index);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  url.searchParams.set("facets", JSON.stringify(facets));

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = await res.json();
    return json.hits.map((hit: any) => {
      const slug = hit.slug || hit.project_id;
      const typePath = hit.project_type || "mod";
      return {
        id: slug,
        slug: slug,
        modrinthId: hit.project_id,
        name: hit.title,
        author: hit.author,
        authorUrl: `https://modrinth.com/user/${hit.author}`,
        websiteUrl: `https://modrinth.com/${typePath}/${slug}`,
        description: hit.description,
        iconUrl: hit.icon_url || "",
        categories: hit.display_categories || hit.categories || [],
        provider: "modrinth",
        type: contentType
      };
    });
  } catch (err) {
    console.error("Modrinth search failed", err);
    return [];
  }
}

const CF_LOADER_MAP: Record<string, number> = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  neoforge: 6
};

async function searchCurseForge(
  query: string, 
  contentType: string, 
  categories: string[], 
  envs: string[], 
  sortBy: string,
  limit: number,
  offset: number,
  mcVersion?: string,
  loader?: string
): Promise<ModItemData[]> {
  const classId = CURSEFORGE_CLASS_IDS[contentType] || 6;
  let sortField = curseforgeSortMap[sortBy];
  
  // If sorting by relevance and there is no query, CurseForge returns random/newest mods if sortField is omitted.
  // The CF website defaults to Popularity (2) when no search query is present.
  if (sortBy === "relevance" && !query) {
    sortField = 2;
  }

  const url = new URL(getCurseforgeProxyUrl("/v1/mods/search"), window.location.origin);
  url.searchParams.set("gameId", "432");
  url.searchParams.set("classId", classId.toString());
  if (query) url.searchParams.set("searchFilter", query);
  
  if (mcVersion) {
    url.searchParams.set("gameVersion", mcVersion);
  }

  // ModLoaderType applies mostly to mods (classId 6)
  if (loader && classId === 6) {
    const modLoaderType = CF_LOADER_MAP[loader.toLowerCase()];
    if (modLoaderType !== undefined) {
      url.searchParams.set("modLoaderType", modLoaderType.toString());
    }
  }

  if (sortField !== undefined) url.searchParams.set("sortField", sortField.toString());
  url.searchParams.set("sortOrder", "desc");
  url.searchParams.set("pageSize", limit.toString());
  url.searchParams.set("index", offset.toString());

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data || [];

    return data.map((mod: any) => {
      const authorObj = mod.authors && mod.authors.length > 0 ? mod.authors[0] : null;
      const author = authorObj ? authorObj.name : "Unknown";
      const authorUrl = authorObj?.url || (author !== "Unknown" ? `https://www.curseforge.com/members/${author}/projects` : undefined);
      const iconUrl = mod.logo ? mod.logo.thumbnailUrl : "";
      const catNames = (mod.categories || []).map((c: any) => c.name);
      const websiteUrl = mod.links?.websiteUrl || `https://www.curseforge.com/minecraft/mc-mods/${mod.slug || mod.id}`;

      return {
        id: mod.id.toString(),
        slug: mod.slug || mod.id.toString(),
        curseforgeId: mod.id,
        name: mod.name,
        author: author,
        authorUrl: authorUrl,
        websiteUrl: websiteUrl,
        description: mod.summary,
        iconUrl: iconUrl,
        categories: catNames,
        provider: "curseforge",
        type: contentType
      };
    });
  } catch (err) {
    console.error("CurseForge search failed", err);
    return [];
  }
}

// --- VERSION FETCHING ---

export async function getModVersions(
  provider: string,
  modId: string,
  mcVersion: string,
  loader: string,
  contentType?: string
): Promise<ModVersion[]> {
  const targetProvider = provider === "all" ? "modrinth" : provider;

  if (targetProvider === "modrinth") {
    return getModrinthVersions(modId, mcVersion, loader, contentType);
  } else if (targetProvider === "curseforge") {
    return getCurseForgeVersions(modId, mcVersion, loader, contentType);
  }
  return [];
}

async function getModrinthVersions(
  modId: string,
  mcVersion: string,
  loader: string,
  contentType?: string
): Promise<ModVersion[]> {
  const url = new URL(`https://api.modrinth.com/v2/project/${modId}/version`);
  
  const isShader = contentType === "shader" || contentType === "shaders";
  const isResourcePack = contentType === "resourcepack" || contentType === "textures" || contentType === "resourcepacks";
  const isDatapack = contentType === "datapack" || contentType === "datapacks";
  const isWorld = contentType === "world" || contentType === "worlds" || contentType === "save" || contentType === "saves";

  // Shaders, Resource Packs, Datapacks, and Worlds do NOT have mod loaders (Fabric/Forge/NeoForge)
  if (!isShader && !isResourcePack && !isDatapack && !isWorld && loader && loader !== "Any") {
    url.searchParams.set("loaders", JSON.stringify([loader.toLowerCase()]));
  }
  
  // Shaders on Modrinth are shaderpacks (OptiFine/Iris/Oculus), independent of exact MC patch version.
  // For other types, pass mcVersion if specified.
  if (mcVersion && mcVersion !== "Any" && !isShader) {
    url.searchParams.set("game_versions", JSON.stringify([mcVersion]));
  }

  try {
    let res = await fetch(url.toString());
    let data: any[] = [];
    if (res.ok) {
      data = await res.json();
    }
    
    // Fallback: If 0 versions found for resourcepacks or datapacks or shaders with strict version,
    // fetch without game_versions so the user can still select versions of the resource!
    const allowVersionFallback = isShader || isResourcePack || isDatapack || isWorld;
    if (data.length === 0 && mcVersion && allowVersionFallback) {
      const fallbackUrl = new URL(`https://api.modrinth.com/v2/project/${modId}/version`);
      const fallbackRes = await fetch(fallbackUrl.toString());
      if (fallbackRes.ok) {
        data = await fallbackRes.json();
      }
    }

    let foundRecommended = false;
    return data.map((v: any) => {
      const stable = v.version_type === "release";
      let recommended = false;
      if (stable && !foundRecommended) {
        recommended = true;
        foundRecommended = true;
      }
      const primaryFile = v.files?.find((f: any) => f.primary) || v.files?.[0];
      return {
        id: v.id,
        name: v.name || v.version_number,
        stable,
        recommended,
        downloadUrl: primaryFile?.url,
        fileName: primaryFile?.filename,
      };
    });
  } catch (e) {
    console.error("Failed to fetch Modrinth versions", e);
    return [];
  }
}

async function getCurseForgeVersions(
  modId: string,
  mcVersion: string,
  loader: string,
  contentType?: string
): Promise<ModVersion[]> {
  const isShader = contentType === "shader" || contentType === "shaders";
  const isResourcePack = contentType === "resourcepack" || contentType === "textures" || contentType === "resourcepacks";
  const isDatapack = contentType === "datapack" || contentType === "datapacks";
  const isWorld = contentType === "world" || contentType === "worlds" || contentType === "save" || contentType === "saves";

  const url = new URL(getCurseforgeProxyUrl(`/v1/mods/${modId}/files`), window.location.origin);
  
  // Shaders, Resource Packs, Datapacks, and Worlds do NOT have mod loaders on CurseForge
  if (!isShader && !isResourcePack && !isDatapack && !isWorld && loader && loader !== "Any") {
    const modLoaderType = CF_LOADER_MAP[loader.toLowerCase()];
    if (modLoaderType !== undefined) {
      url.searchParams.set("modLoaderType", modLoaderType.toString());
    }
  }

  // Shaders on Curseforge are often not tagged for exact minor mcVersion
  if (mcVersion && mcVersion !== "Any" && !isShader) {
    url.searchParams.set("gameVersion", mcVersion);
  }

  try {
    let res = await fetch(url.toString());
    let files: any[] = [];
    if (res.ok) {
      const json = await res.json();
      files = json.data || [];
    }

    // Fallback: If 0 files found (only for shaders, resource packs, datapacks, or worlds that might be version agnostic)
    const allowVersionFallback = isShader || isResourcePack || isDatapack || isWorld;
    if (files.length === 0 && allowVersionFallback) {
      const fallbackUrl = new URL(getCurseforgeProxyUrl(`/v1/mods/${modId}/files`), window.location.origin);
      const fallbackRes = await fetch(fallbackUrl.toString());
      if (fallbackRes.ok) {
        const json = await fallbackRes.json();
        files = json.data || [];
      }
    }

    let foundRecommended = false;
    return files.map((f: any) => {
      const stable = f.releaseType === 1;
      let recommended = false;
      if (stable && !foundRecommended) {
        recommended = true;
        foundRecommended = true;
      }
      return {
        id: f.id.toString(),
        name: f.displayName,
        stable,
        recommended,
        downloadUrl: f.downloadUrl,
        fileName: f.fileName,
      };
    });
  } catch (e) {
    console.error("Failed to fetch CF versions", e);
    return [];
  }
}
