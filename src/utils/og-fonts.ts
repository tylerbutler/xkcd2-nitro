import type { ImageResponse } from "@vercel/og";

type ImageResponseOptions = NonNullable<
	ConstructorParameters<typeof ImageResponse>[1]
>;
type OgFont = NonNullable<ImageResponseOptions["fonts"]>[number];

const FONT_STYLESHEET = "https://use.typekit.net/zst8lfn.css";
const FONT_FAMILIES = ["museo-sans", "museo-slab"];
const FONT_FACE_PATTERN = /@font-face\s*\{[^}]*\}/g;
const FONT_FAMILY_PATTERN = /font-family:\s*["']?([^"';]+)["']?\s*;/;
const NORMAL_STYLE_PATTERN = /font-style:\s*normal\s*;/;
const LIGHT_WEIGHT_PATTERN = /font-weight:\s*300\s*;/;
// Satori supports WOFF, but not the kit's preferred WOFF2 format.
const WOFF_URL_PATTERN = /url\(["']?([^"')]+)["']?\)\s*format\(["']woff["']\)/;
let fontsPromise: Promise<OgFont[]> | undefined;

async function loadFonts(): Promise<OgFont[]> {
	const stylesheetResponse = await fetch(FONT_STYLESHEET, {
		signal: AbortSignal.timeout(10_000),
	});
	if (!stylesheetResponse.ok) {
		throw new Error(
			`Failed to load the site font stylesheet: ${stylesheetResponse.status}`,
		);
	}

	const stylesheet = await stylesheetResponse.text();
	const faces = stylesheet.match(FONT_FACE_PATTERN) ?? [];

	return Promise.all(
		FONT_FAMILIES.map(async (name): Promise<OgFont> => {
			const face = faces.find(
				(candidate) =>
					candidate.match(FONT_FAMILY_PATTERN)?.[1] === name &&
					NORMAL_STYLE_PATTERN.test(candidate) &&
					LIGHT_WEIGHT_PATTERN.test(candidate),
			);
			const url = face?.match(WOFF_URL_PATTERN)?.[1];
			if (!url) {
				throw new Error(
					`The site font stylesheet is missing ${name} normal 300 in WOFF format`,
				);
			}

			const response = await fetch(url, {
				signal: AbortSignal.timeout(10_000),
			});
			if (!response.ok) {
				throw new Error(`Failed to load ${name}: ${response.status}`);
			}

			return {
				name,
				data: await response.arrayBuffer(),
				weight: 300,
				style: "normal",
			};
		}),
	);
}

export function getOgFonts(): Promise<OgFont[]> {
	fontsPromise ??= loadFonts().catch((error) => {
		fontsPromise = undefined;
		throw error;
	});
	return fontsPromise;
}
