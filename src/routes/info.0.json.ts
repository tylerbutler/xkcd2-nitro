import { getCachedComic } from "../utils/xkcd-cache";

export default defineEventHandler(async (event) => {
	try {
		const result = await getCachedComic();

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
				statusMessage: "Comic not found",
			});
		}
		throw error;
	}
});
