import type { ComicFrameProps } from "@tylerbu/xkcd2-api";

import nunjucksPkg from "nunjucks";
const { configure } = nunjucksPkg;

import typogr from "typogr";
const { typogrify } = typogr;

import { comicExists, fetchComic } from "./xkcd-proxy";

const nunjucks = configure({
	autoescape: true,
	lstripBlocks: true,
	watch: true,
});

nunjucks.addFilter("typogrify", (input: string) => {
	return typogrify(input);
});

async function getComicProps(
	comicId?: string | number,
): Promise<ComicFrameProps> {
	const comic = await fetchComic(comicId);
	const previousId = String(comic.num - 1);
	const nextId = String(comic.num + 1);

	// Check if next comic exists
	const hasNext = await comicExists(nextId);

	if (hasNext) {
		return { comic, previousId, nextId };
	}

	return { comic, previousId };
}

export async function renderComicPage(
	comicId?: string | number,
): Promise<string> {
	const { comic } = await getComicProps(comicId);
	const templateData = await useStorage("assets:templates").getItem("base.njk");
	// Template is stored as Uint8Array in production builds, need to decode it
	const template =
		templateData instanceof Uint8Array
			? new TextDecoder().decode(templateData)
			: String(templateData);
	const html = nunjucks.renderString(template, {
		comic,
		isHome: comicId === undefined,
	});
	return html;
}

async function getLatestComic() {
	// Fetch latest comic using the cached proxy
	return fetchComic();
}

export async function getRandomComicId(): Promise<number> {
	const { num } = await getLatestComic();

	// I don't think a cryptographically sound RNG is needed for this
	const randomValue = Math.random();
	const randId = Math.floor(randomValue * num);
	return randId;
}
