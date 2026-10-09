import type { Comic } from "@tylerbu/xkcd2-api";

import nunjucksPkg from "nunjucks";
const { configure } = nunjucksPkg;

import typogr from "typogr";
const { typogrify } = typogr;

import { MISSING_COMIC_ID, getCachedComic } from "./xkcd-cache";

const nunjucks = configure({
	autoescape: true,
	lstripBlocks: true,
	watch: true,
});

nunjucks.addFilter("typogrify", (input: string) => {
	return typogrify(input);
});

type ComicTemplateData =
	| {
			comic: Comic;
			previousId?: number;
			nextId?: number;
			imageDescription: string;
			origin: string;
	  }
	| {
			error: { title: string; message: string; retryUrl?: string };
			origin: string;
	  };

async function renderComicTemplate(data: ComicTemplateData): Promise<string> {
	const templateData = await useStorage("assets:templates").getItem("base.njk");
	// Template is stored as Uint8Array in production builds, need to decode it
	const template =
		templateData instanceof Uint8Array
			? new TextDecoder().decode(templateData)
			: String(templateData);
	return nunjucks.renderString(template, data);
}

export async function renderComicPage(
	comicId?: string | number,
	origin = "",
): Promise<string> {
	const { comic } = await getCachedComic(comicId);
	const latest =
		comicId === undefined || comicId === ""
			? comic
			: (await getCachedComic()).comic;
	const previousId =
		comic.num > 1
			? comic.num - (comic.num === MISSING_COMIC_ID + 1 ? 2 : 1)
			: undefined;
	const nextId =
		comic.num < latest.num
			? comic.num + (comic.num === MISSING_COMIC_ID - 1 ? 2 : 1)
			: undefined;
	// Legacy transcripts include hover text as {{Alt: ...}} metadata.
	const transcript = comic.transcript
		?.replace(/\{\{(?:alt|title text):[\s\S]*?\}\}/gi, "")
		.replace(/\s+/g, " ")
		.trim();
	const imageDescription =
		transcript ||
		`Comic ${comic.num}: ${comic.safe_title ?? comic.title ?? "Untitled"}. No transcript is available.`;

	return renderComicTemplate({
		comic,
		previousId,
		nextId,
		imageDescription,
		origin,
	});
}

export async function renderComicErrorPage(
	error: unknown,
	origin: string,
	retryUrl: string,
): Promise<{ html: string; statusCode: number }> {
	const statusCode =
		error &&
		typeof error === "object" &&
		"statusCode" in error &&
		typeof error.statusCode === "number" &&
		error.statusCode >= 400 &&
		error.statusCode <= 599
			? error.statusCode
			: error instanceof Error && error.name === "FetchError"
				? 503
				: undefined;

	if (statusCode === undefined) {
		throw error;
	}
	const notFound = statusCode === 404;
	if (!notFound) {
		console.error("Failed to load an xkcd comic:", error);
	}
	const html = await renderComicTemplate({
		error: {
			title: notFound ? "Comic not found" : "Comic unavailable",
			message: notFound
				? "This comic does not exist. Choose another comic to keep reading."
				: "We could not load this comic. Try again, or choose another comic.",
			retryUrl: notFound ? undefined : retryUrl,
		},
		origin,
	});
	return { html, statusCode };
}

export async function getComicPageResponse(
	comicId?: string | number,
	origin = "",
): Promise<{ html: string; statusCode: number }> {
	try {
		return { html: await renderComicPage(comicId, origin), statusCode: 200 };
	} catch (error) {
		return renderComicErrorPage(
			error,
			origin,
			comicId === undefined ? "/" : `/${encodeURIComponent(comicId)}/`,
		);
	}
}

export async function getRandomComicId(): Promise<number> {
	const {
		comic: { num },
	} = await getCachedComic();
	const count = num >= MISSING_COMIC_ID ? num - 1 : num;
	const comicId = Math.floor(Math.random() * count) + 1;
	return comicId >= MISSING_COMIC_ID ? comicId + 1 : comicId;
}
