import type { Comic } from "@tylerbu/xkcd2-api";

const XKCD_BASE_URL = "https://xkcd.com";

/**
 * Cache TTL values in seconds
 */
const CACHE_TTL = {
	// Latest comic might update, so shorter TTL
	latest: 60 * 5, // 5 minutes
	// Specific comics don't change, cache indefinitely (1 year)
	specific: 60 * 60 * 24 * 365,
} as const;

/**
 * Get the storage key for a comic
 */
function getStorageKey(comicId?: string | number): string {
	if (comicId === undefined || comicId === "") {
		return "latest";
	}
	return `comic:${comicId}`;
}

/**
 * Get the xkcd.com URL for a comic
 */
function getXkcdUrl(comicId?: string | number): string {
	if (comicId === undefined || comicId === "") {
		return `${XKCD_BASE_URL}/info.0.json`;
	}
	return `${XKCD_BASE_URL}/${comicId}/info.0.json`;
}

interface CachedComic {
	comic: Comic;
	cachedAt: number;
	ttl: number;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(cached: CachedComic): boolean {
	const now = Date.now();
	const expiresAt = cached.cachedAt + cached.ttl * 1000;
	return now < expiresAt;
}

/**
 * Fetch a comic from xkcd.com with caching
 * Returns cached version if available and valid, otherwise fetches from xkcd.com
 */
export async function fetchComic(comicId?: string | number): Promise<Comic> {
	const storage = useStorage("xkcd");
	const storageKey = getStorageKey(comicId);

	// Try to get from cache first
	const cached = await storage.getItem<CachedComic>(storageKey);
	if (cached && isCacheValid(cached)) {
		return cached.comic;
	}

	// Fetch from xkcd.com
	const url = getXkcdUrl(comicId);
	const comic = await $fetch<Comic>(url);

	// Determine TTL based on whether this is the latest comic or a specific one
	const isLatest = comicId === undefined || comicId === "";
	const ttl = isLatest ? CACHE_TTL.latest : CACHE_TTL.specific;

	// Cache the result
	const cacheEntry: CachedComic = {
		comic,
		cachedAt: Date.now(),
		ttl,
	};
	await storage.setItem(storageKey, cacheEntry);

	// If this was a "latest" request, also cache by comic ID for future direct lookups
	if (isLatest) {
		const specificKey = getStorageKey(comic.num);
		const specificEntry: CachedComic = {
			comic,
			cachedAt: Date.now(),
			ttl: CACHE_TTL.specific,
		};
		await storage.setItem(specificKey, specificEntry);
	}

	return comic;
}

/**
 * Check if a comic exists (for determining if there's a "next" comic)
 */
export async function comicExists(comicId: string | number): Promise<boolean> {
	try {
		await fetchComic(comicId);
		return true;
	} catch {
		return false;
	}
}
