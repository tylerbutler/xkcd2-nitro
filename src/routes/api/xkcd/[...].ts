import type { Comic } from "@tylerbu/xkcd2-api";

const XKCD_BASE_URL = "https://xkcd.com";
const CACHE_PREFIX = "comic:";
const LATEST_CACHE_KEY = "latest";
const LATEST_CACHE_TTL = 60 * 60; // 1 hour for latest comic

interface CachedComic {
	comic: Comic;
	cachedAt: number;
}

function getXkcdApiUrl(comicId?: string | number): string {
	if (comicId === undefined || comicId === "" || comicId === "latest") {
		return `${XKCD_BASE_URL}/info.0.json`;
	}
	return `${XKCD_BASE_URL}/${comicId}/info.0.json`;
}

export default defineEventHandler(async (event) => {
	const path = getRouterParam(event, "_");
	const comicId = path || "latest";
	const isLatest = comicId === "latest" || comicId === "";

	const storage = useStorage("xkcd");
	const cacheKey = isLatest ? LATEST_CACHE_KEY : `${CACHE_PREFIX}${comicId}`;

	// Try to get from cache first
	const cached = await storage.getItem<CachedComic>(cacheKey);

	if (cached) {
		// For latest comic, check if cache is still valid
		if (isLatest) {
			const age = (Date.now() - cached.cachedAt) / 1000;
			if (age < LATEST_CACHE_TTL) {
				setResponseHeader(event, "X-Cache", "HIT");
				setResponseHeader(event, "X-Cache-Age", String(Math.floor(age)));
				return cached.comic;
			}
		} else {
			// Specific comics are cached indefinitely
			setResponseHeader(event, "X-Cache", "HIT");
			return cached.comic;
		}
	}

	// Fetch from xkcd.com
	const url = getXkcdApiUrl(comicId);

	try {
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

		setResponseHeader(event, "X-Cache", "MISS");
		return comic;
	} catch (error) {
		// Return 404 for comics that don't exist
		if (
			error &&
			typeof error === "object" &&
			"statusCode" in error &&
			error.statusCode === 404
		) {
			throw createError({
				statusCode: 404,
				statusMessage: `Comic ${comicId} not found`,
			});
		}
		throw error;
	}
});
