import { getCachedComic } from "../../utils/xkcd-cache";

export default defineEventHandler(async (event) => {
	const comicId = getRouterParam(event, "comicId");

	try {
		const result = await getCachedComic(comicId);

		setResponseHeader(event, "X-Cache", result.cacheHit ? "HIT" : "MISS");
		if (result.cacheAge !== undefined) {
			setResponseHeader(event, "X-Cache-Age", String(Math.floor(result.cacheAge)));
		}

		return result.comic;
	} catch (error) {
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
