import type { Comic, ComicFrameProps } from "@tylerbu/xkcd2-api";

import nunjucksPkg from "nunjucks";
const { configure } = nunjucksPkg;

import typogr from "typogr";
const { typogrify } = typogr;

const nunjucks = configure({
	autoescape: true,
	lstripBlocks: true,
	watch: true,
});

nunjucks.addFilter("typogrify", (input: string) => {
	return typogrify(input);
});

function getComicUrl(comicId?: string | number) {
	if (comicId === undefined || comicId === "") {
		return "https://xkcd.com/info.0.json";
	}
	return `https://xkcd.com/${comicId}/info.0.json`;
}

async function getComicProps(
	comicId?: string | number,
): Promise<ComicFrameProps> {
	const url = getComicUrl(comicId);
	const comic = await $fetch<Comic>(url);
	const previousId = String(comic.num - 1);
	const nextId = String(comic.num + 1);

	// Try to get the next comic's JSON. If it 404s, then there's no next comic
	const nextUrl = getComicUrl(nextId);
	let hasNext = true;
	const _ = await $fetch<Comic>(nextUrl).catch((_error) => {
		hasNext = false;
	});

	if (hasNext) {
		return { comic, previousId, nextId };
	}

	return { comic, previousId };
}

export async function renderComicPage(
	comicId?: string | number,
): Promise<string> {
	const { comic } = await getComicProps(comicId);
	const template = await useStorage("assets:templates").getItem("base.njk");
	const html = nunjucks.renderString(template.toString(), {
		comic,
		isHome: comicId === undefined,
	});
	return html;
}

const getLatestComic = async () => {
	// Call without any arguments to get the latest comic details
	const { comic } = await getComicProps();
	return comic;
};

// biome-ignore lint/correctness/noUnusedVariables: <explanation>
const cachedLatestComic = cachedFunction(getLatestComic, {
	maxAge: 60 * 60, // 1 hour
	name: "latestComicId",
});

export async function getRandomComicId(): Promise<number> {
	const { num } = await getLatestComic();

	// I don't think a cryptographically sound RNG is needed for this
	const randomValue = Math.random();
	const randId = Math.floor(randomValue * num);
	return randId;
}
