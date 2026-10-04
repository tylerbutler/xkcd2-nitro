import { ImageResponse } from "@vercel/og";
import { createElement } from "react";

import { getOgFonts } from "../../utils/og-fonts";
import { getCachedComic } from "../../utils/xkcd-cache";

const COMIC_IMAGE_PATTERN = /^(\d+)\.png$/;
const ACCENT_COLOR = "hsl(217, 71%, 53%)";
const COMIC_IMAGE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/svg+xml",
]);

export default defineEventHandler(async (event) => {
	const match = getRouterParam(event, "id")?.match(COMIC_IMAGE_PATTERN);

	if (!match) {
		throw createError({
			statusCode: 400,
			statusMessage: "Invalid comic ID",
		});
	}

	const { comic } = await getCachedComic(match[1]);
	const [fonts, artworkResponse] = await Promise.all([
		getOgFonts(),
		fetch(comic.img, { signal: AbortSignal.timeout(10_000) }),
	]);
	if (!artworkResponse.ok) {
		throw createError({
			statusCode: 502,
			statusMessage: "Failed to load comic artwork",
		});
	}
	const contentType = artworkResponse.headers
		.get("content-type")
		?.split(";")[0]
		.trim();
	if (!(contentType && COMIC_IMAGE_TYPES.has(contentType))) {
		throw createError({
			statusCode: 502,
			statusMessage: "Unsupported comic artwork format",
		});
	}
	const artwork = `data:${contentType};base64,${Buffer.from(
		await artworkResponse.arrayBuffer(),
	).toString("base64")}`;

	const image = createElement(
		"div",
		{
			style: {
				width: "100%",
				height: "100%",
				position: "relative",
				overflow: "hidden",
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
		createElement("img", {
			src: artwork,
			alt: "",
			style: {
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				objectFit: "cover",
				transform: "scale(1.15)",
				opacity: 0.18,
			},
		}),
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
						alignItems: "center",
						fontSize: 40,
						fontFamily: "museo-slab",
					},
				},
				createElement("span", {}, "xkcd"),
				createElement(
					"span",
					{
						style: {
							color: "#fff",
							backgroundColor: ACCENT_COLOR,
							borderRadius: 2,
							fontSize: 28,
							marginLeft: 7,
							padding: "0 12px",
						},
					},
					"2",
				),
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
				backgroundColor: ACCENT_COLOR,
				borderRadius: 4,
			},
		}),
	);

	return new ImageResponse(image, { width: 1200, height: 630, fonts });
});
