import type { Comic } from "@tylerbu/xkcd2-api";

const XKCD_BASE_URL = "https://xkcd.com";
const CACHE_PREFIX = "comic:";
const LATEST_CACHE_KEY = "latest";
const LATEST_CACHE_TTL = 60 * 60; // 1 hour for latest comic

interface CachedComic {
	comic: Comic;
	cachedAt: number;
}

interface CacheResult {
	comic: Comic;
	cacheHit: boolean;
	cacheAge?: number;
}

function getXkcdApiUrl(comicId?: string | number): string {
	if (comicId === undefined || comicId === "") {
		return `${XKCD_BASE_URL}/info.0.json`;
	}
	return `${XKCD_BASE_URL}/${comicId}/info.0.json`;
}

export async function getCachedComic(
	comicId?: string | number,
): Promise<CacheResult> {
	const isLatest = comicId === undefined || comicId === "";
	const storage = useStorage("xkcd");
	const cacheKey = isLatest ? LATEST_CACHE_KEY : `${CACHE_PREFIX}${comicId}`;

	// Try to get from cache first
	const cached = await storage.getItem<CachedComic>(cacheKey);

	if (cached) {
		// For latest comic, check if cache is still valid
		if (isLatest) {
			const age = (Date.now() - cached.cachedAt) / 1000;
			if (age < LATEST_CACHE_TTL) {
				return { comic: cached.comic, cacheHit: true, cacheAge: age };
			}
		} else {
			// Specific comics are cached indefinitely
			return { comic: cached.comic, cacheHit: true };
		}
	}

	// Fetch from xkcd.com
	const url = getXkcdApiUrl(comicId);
	const comic = await $fetch<Comic>(url);

	// Cache the result
	const cacheData: CachedComic = {
		comic,
		cachedAt: Date.now(),
	};

	await storage.setItem(cacheKey, cacheData);

	// If this was a "latest" request, also cache it by its actual comic ID
	if (isLatest) {
		const specificKey = `${CACHE_PREFIX}${comic.num}`;
		await storage.setItem(specificKey, cacheData);
	}

	return { comic, cacheHit: false };
}
