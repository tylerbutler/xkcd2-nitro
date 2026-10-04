import { ImageResponse } from "@vercel/og";
import { createElement } from "react";

import { getCachedComic } from "../../utils/xkcd-cache";

const COMIC_ID_PATTERN = /^\d+$/;

export default defineEventHandler(async (event) => {
	const comicId = getRouterParam(event, "id");

	if (!COMIC_ID_PATTERN.test(comicId ?? "")) {
		throw createError({
			statusCode: 400,
			statusMessage: "Invalid comic ID",
		});
	}

	const { comic } = await getCachedComic(comicId);

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
				fontFamily: "sans-serif",
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
				{ style: { fontSize: 40, fontWeight: 700 } },
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
						fontWeight: 700,
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

	return new ImageResponse(image, { width: 1200, height: 630 });
});
