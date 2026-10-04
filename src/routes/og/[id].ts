import { ImageResponse } from "@vercel/og";
import { createElement } from "react";

import { getOgFonts } from "../../utils/og-fonts";
import { getCachedComic } from "../../utils/xkcd-cache";

const COMIC_IMAGE_PATTERN = /^(\d+)\.png$/;

export default defineEventHandler(async (event) => {
	const match = getRouterParam(event, "id")?.match(COMIC_IMAGE_PATTERN);

	if (!match) {
		throw createError({
			statusCode: 400,
			statusMessage: "Invalid comic ID",
		});
	}

	const { comic } = await getCachedComic(match[1]);
	const fonts = await getOgFonts();

	const image = createElement(
		"div",
		{
			style: {
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: "64px 72px",
				backgroundColor: "#fffaf0",
				color: "#202020",
				fontFamily: "museo-sans",
				fontWeight: 400,
			},
		},
		createElement(
			"div",
			{
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				},
			},
			createElement(
				"div",
				{
					style: {
						display: "flex",
						fontSize: 40,
						fontFamily: "museo-slab",
					},
				},
				createElement("span", {}, "xkcd"),
				createElement("span", { style: { color: "#f5a623" } }, "2"),
			),
			createElement(
				"div",
				{
					style: {
						fontSize: 22,
						color: "#666",
						border: "2px solid #ddd",
						borderRadius: 999,
						padding: "10px 18px",
					},
				},
				`COMIC #${comic.num}`,
			),
		),
		createElement(
			"div",
			{
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 22,
					maxWidth: "100%",
				},
			},
			createElement(
				"div",
				{
					style: {
						fontSize: 58,
						fontFamily: "museo-slab",
						fontWeight: 300,
						lineHeight: 1.1,
					},
				},
				comic.safe_title,
			),
			createElement(
				"div",
				{
					style: {
						fontSize: 27,
						lineHeight: 1.35,
						color: "#555",
					},
				},
				comic.alt.length > 220 ? `${comic.alt.slice(0, 217)}…` : comic.alt,
			),
		),
		createElement("div", {
			style: {
				display: "flex",
				height: 8,
				backgroundColor: "#f5a623",
				borderRadius: 4,
			},
		}),
	);

	return new ImageResponse(image, { width: 1200, height: 630, fonts });
});
