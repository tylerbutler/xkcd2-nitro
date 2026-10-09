import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { build, copyPublicAssets, createNitro } from "nitropack";

import { getOgFonts } from "../src/utils/og-fonts.ts";

const fontFamilies = ["museo-sans", "museo-slab"];
const fontStylesheet = fontFamilies
	.map(
		(name) => `
			@font-face {
				font-family:"${name}";font-style:italic;font-weight:300;
				src:url("https://use.typekit.net/test/${name}-italic.woff") format("woff");
			}
			@font-face {
				font-family:"${name}";font-style:normal;font-weight:700;
				src:url("https://use.typekit.net/test/${name}-bold.woff") format("woff");
			}
			@font-face {
				font-family:"${name}";font-style:normal;font-weight:300;
				src:url("https://use.typekit.net/test/${name}.woff2") format("woff2"),
					url("https://use.typekit.net/test/${name}.woff") format("woff");
			}
		`,
	)
	.join("\n");
const fontRequests = [];
let stylesheetStatus = 200;
let stylesheetBody = fontStylesheet;
let fontStatus = 200;
let fontData;

const comic = {
	num: 1,
	safe_title: 'A "quoted" title & comic',
	alt: "Don't we all.",
	img: "https://imgs.xkcd.com/comics/barrel_cropped_(1).jpg",
	transcript:
		'[[A boy floats in a barrel.]]\nBoy: "Where next?"\n{{Alt: Don\'t we all.}}',
};
let latestComic = comic;
let apiStatus = 200;
let testClock = Date.now();
const artworkRequests = [];
let artworkData;
let artworkStatus = 200;
let artworkContentType = "image/png";
const longComic = { ...comic, alt: "A long caption. ".repeat(30) };
const longTitleComic = {
	...comic,
	num: 3,
	transcript: "",
	safe_title:
		"A longer comic title that wraps onto a second line above the blue accent bar",
};
let directory;
let nitro;
let server;
let origin;

before(async () => {
	fontData = await readFile(
		new URL(
			"../node_modules/@vercel/og/dist/noto-sans-v27-latin-regular.ttf",
			import.meta.url,
		),
	);
	artworkData = await readFile(
		new URL("../src/public/android-chrome-192x192.png", import.meta.url),
	);
	const originalFetch = globalThis.fetch;
	mock.method(globalThis, "fetch", (input, options) => {
		const url = new URL(input instanceof Request ? input.url : input);
		if (url.hostname === "xkcd.com") {
			const status =
				apiStatus === 200 && url.pathname !== "/info.0.json" ? 404 : apiStatus;
			return Promise.resolve(
				new Response(JSON.stringify(status === 200 ? latestComic : {}), {
					status,
					headers: { "content-type": "application/json" },
				}),
			);
		}
		if (url.href === comic.img) {
			artworkRequests.push(url.href);
			return Promise.resolve(
				new Response(artworkData, {
					status: artworkStatus,
					headers: { "content-type": artworkContentType },
				}),
			);
		}
		if (url.hostname !== "use.typekit.net") {
			return originalFetch(input, options);
		}
		fontRequests.push(url.href);
		if (url.pathname === "/zst8lfn.css") {
			return Promise.resolve(
				new Response(stylesheetBody, { status: stylesheetStatus }),
			);
		}
		if (fontFamilies.some((name) => url.pathname === `/test/${name}.woff`)) {
			return Promise.resolve(new Response(fontData, { status: fontStatus }));
		}
		throw new Error(`Unexpected font request: ${url.href}`);
	});

	directory = await mkdtemp(join(tmpdir(), "xkcd2-og-"));
	const fixturePlugin = join(directory, "fixtures.mjs");
	nitro = await createNitro({
		preset: "vercel",
		logLevel: 0,
		buildDir: join(directory, "nitro"),
		output: { dir: join(directory, "output") },
		storage: { xkcd: { driver: "memory" } },
		plugins: [fixturePlugin],
		virtual: {
			[fixturePlugin]: `
				import { defineNitroPlugin, useStorage } from "#imports";
				export default defineNitroPlugin(async () => {
					const storage = useStorage("xkcd");
					const comic = ${JSON.stringify(comic)};
					const longComic = ${JSON.stringify(longComic)};
					const longTitleComic = ${JSON.stringify(longTitleComic)};
					const cachedAt = Date.now();
					await storage.setItem("comic:1", { comic, cachedAt });
					await storage.setItem("comic:2", { comic: longComic, cachedAt });
					await storage.setItem("comic:3", { comic: longTitleComic, cachedAt });
					for (const num of [403, 405]) {
						await storage.setItem("comic:" + num, { comic: { ...comic, num }, cachedAt });
					}
					await storage.setItem("latest", { comic, cachedAt });
				});
			`,
		},
	});
	await copyPublicAssets(nitro);
	await build(nitro);
	const { default: nunjucks } = await import(
		pathToFileURL(
			join(nitro.options.output.serverDir, "node_modules/nunjucks/index.js"),
		).href
	);
	const configure = nunjucks.configure;
	// Template watching is not needed for a production-build test.
	mock.method(nunjucks, "configure", (options) =>
		configure({ ...options, watch: false }),
	);
	const { default: handler } = await import(
		pathToFileURL(join(nitro.options.output.serverDir, "index.mjs")).href
	);
	server = createServer(handler);
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
	if (server) {
		await new Promise((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	}
	mock.restoreAll();
	await nitro?.close();
	if (directory) {
		await rm(directory, { recursive: true, force: true });
	}
});

test("font load failures are explicit and can be retried", async () => {
	stylesheetStatus = 503;
	await assert.rejects(getOgFonts(), {
		message: "Failed to load the site font stylesheet: 503",
	});
	stylesheetStatus = 200;
	stylesheetBody = "";
	await assert.rejects(getOgFonts(), {
		message:
			"The site font stylesheet is missing museo-sans normal 300 in WOFF format",
	});
	stylesheetBody = fontStylesheet;
	fontStatus = 503;
	await assert.rejects(getOgFonts(), {
		message: "Failed to load museo-sans: 503",
	});
	fontStatus = 200;
});

test("loads and caches the site's normal Museo fonts using WOFF URLs", async () => {
	const requestCount = fontRequests.length;
	const [fonts, concurrentFonts] = await Promise.all([
		getOgFonts(),
		getOgFonts(),
	]);
	assert.equal(concurrentFonts, fonts);
	assert.equal(fontRequests.length, requestCount + 3);
	assert.deepEqual(
		fonts.map(({ name, weight, style }) => ({ name, weight, style })),
		fontFamilies.map((name) => ({ name, weight: 300, style: "normal" })),
	);
	for (const font of fonts) {
		assert.deepEqual(Buffer.from(font.data), fontData);
	}
	assert.equal(await getOgFonts(), fonts);
	assert.equal(fontRequests.length, requestCount + 3);
});

for (const path of ["/", "/1/"]) {
	test(`${path} uses absolute social image URLs`, async () => {
		const response = await fetch(`${origin}${path}`);
		assert.equal(response.status, 200);
		const html = await response.text();
		for (const tag of ['property="og:image"', 'name="twitter:image"']) {
			assert.ok(html.includes(`${tag} content="${origin}/og/1.png"`));
		}
		assert.ok(
			html.includes('content="xkcd 2: A &quot;quoted&quot; title &amp; comic"'),
		);
		assert.ok(html.includes('href="https://use.typekit.net/zst8lfn.css"'));
	});
}

for (const id of [1, 2, 3]) {
	test(`/og/${id}.png returns a complete 1200x630 PNG`, async () => {
		const requestCount = fontRequests.length;
		const artworkRequestCount = artworkRequests.length;
		const response = await fetch(`${origin}/og/${id}.png`);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-type"), "image/png");
		const image = Buffer.from(await response.arrayBuffer());
		assert.deepEqual(
			image.subarray(0, 8),
			Buffer.from("89504e470d0a1a0a", "hex"),
		);
		assert.equal(image.toString("ascii", 12, 16), "IHDR");
		assert.equal(image.readUInt32BE(16), 1200);
		assert.equal(image.readUInt32BE(20), 630);
		assert.equal(
			image.toString("ascii", image.length - 8, image.length - 4),
			"IEND",
		);
		assert.equal(fontRequests.length, requestCount + (id === 1 ? 3 : 0));
		assert.equal(artworkRequests.length, artworkRequestCount + 1);
		assert.equal(artworkRequests.at(-1), comic.img);
	});
}

test("OG images do not include the secondary caption", async () => {
	const images = await Promise.all(
		[1, 2].map(async (id) => {
			const response = await fetch(`${origin}/og/${id}.png`);
			assert.equal(response.status, 200);
			return Buffer.from(await response.arrayBuffer());
		}),
	);
	assert.deepEqual(images[0], images[1]);
});

for (const { status, contentType, message } of [
	{
		status: 503,
		contentType: "image/png",
		message: "Failed to load comic artwork",
	},
	{
		status: 200,
		contentType: "text/html",
		message: "Unsupported comic artwork format",
	},
]) {
	test(`artwork errors are explicit: ${message}`, async () => {
		artworkStatus = status;
		artworkContentType = contentType;
		try {
			const response = await fetch(`${origin}/og/1.png`);
			assert.equal(response.status, 502);
			const error = await response.json();
			assert.equal(error.statusMessage, message);
		} finally {
			artworkStatus = 200;
			artworkContentType = "image/png";
		}
	});
}

for (const path of ["/og/1", "/og/invalid.png", "/og/1.jpg"]) {
	test(`${path} rejects invalid image filenames`, async () => {
		const response = await fetch(`${origin}${path}`);
		assert.equal(response.status, 400);
		const error = await response.json();
		assert.equal(error.statusMessage, "Invalid comic ID");
	});
}

test("first and latest boundaries disable unavailable navigation", async () => {
	const response = await fetch(`${origin}/1/`);
	assert.equal(response.status, 200);
	const html = await response.text();
	assert.ok(!html.includes('href="/0/"'));
	assert.match(html, /aria-disabled="true" title="First comic"/);
	assert.match(html, /aria-disabled="true" title="next comic"/);
});

test("reader artwork has an escaped transcript and a named full-size action", async () => {
	const response = await fetch(`${origin}/1/`);
	const html = await response.text();
	assert.ok(
		html.includes(
			'alt="[[A boy floats in a barrel.]] Boy: &quot;Where next?&quot;"',
		),
	);
	assert.ok(
		html.includes('aria-label="Open full-size comic: A &quot;quoted&quot;'),
	);
	assert.ok(html.includes("Open full-size comic</span>"));
	assert.ok(html.includes('<main id="reader"'));
	assert.ok(html.includes('aria-label="Comic navigation"'));
	assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
	assert.ok(html.includes('href="/css/reader.css"'));
});

test("missing transcripts are identified without inventing artwork descriptions", async () => {
	const response = await fetch(`${origin}/3/`);
	const html = await response.text();
	assert.ok(html.includes("No transcript is available."));
});

test("the scoped reader stylesheet is served in production", async () => {
	const response = await fetch(`${origin}/css/reader.css`);
	assert.equal(response.status, 200);
	assert.match(response.headers.get("content-type"), /text\/css/);
	assert.ok((await response.text()).includes("#comic-nav .button"));
});

for (const path of ["/0/", "/404/", "/999999/", "/-1/", "/1.5/"]) {
	test(`${path} has an HTML recovery page and keeps its 404 status`, async () => {
		const response = await fetch(`${origin}${path}`);
		assert.equal(response.status, 404);
		assert.match(response.headers.get("content-type"), /text\/html/);
		const html = await response.text();
		assert.ok(html.includes("Comic not found"));
		assert.ok(html.includes('href="/">Latest comic</a>'));
		assert.ok(html.includes('href="/random/">Random comic</a>'));
		assert.ok(html.includes('name="robots" content="noindex"'));
		assert.ok(!html.includes('property="og:image"'));
		assert.ok(html.indexOf("</main>") > html.indexOf('id="recovery-nav"'));
	});
}

test("JSON clients keep structured missing-comic errors", async () => {
	const response = await fetch(`${origin}/404/info.0.json`);
	assert.equal(response.status, 404);
	assert.match(response.headers.get("content-type"), /application\/json/);
	assert.equal((await response.json()).statusCode, 404);
});

test("random includes both endpoints and skips the archive gap", async (t) => {
	let randomValue = 0;
	t.mock.method(Math, "random", () => randomValue);
	t.mock.method(Date, "now", () => testClock);
	for (const { latest, sample, expected } of [
		{ latest: 1, sample: 0, expected: 1 },
		{ latest: 1, sample: 1 - Number.EPSILON, expected: 1 },
		{ latest: 3, sample: 0, expected: 1 },
		{ latest: 3, sample: 1 - Number.EPSILON, expected: 3 },
		{ latest: 403, sample: 1 - Number.EPSILON, expected: 403 },
		{ latest: 405, sample: 403.5 / 404, expected: 405 },
		{ latest: 406, sample: 402.5 / 405, expected: 403 },
		{ latest: 406, sample: 403.5 / 405, expected: 405 },
		{ latest: 406, sample: 1 - Number.EPSILON, expected: 406 },
	]) {
		testClock += 60 * 60 * 1000 + 1;
		latestComic = { ...comic, num: latest };
		randomValue = sample;
		const response = await fetch(`${origin}/random/`, { redirect: "manual" });
		assert.equal(response.status, 302);
		assert.equal(response.headers.get("location"), `/${expected}`);
	}
});

test("sequential browsing skips comic 404 in both directions", async () => {
	for (const [id, neighbor] of [
		[403, 405],
		[405, 403],
	]) {
		const response = await fetch(`${origin}/${id}/`);
		assert.equal(response.status, 200);
		const html = await response.text();
		assert.ok(html.includes(`href="/${neighbor}/"`));
		assert.ok(!html.includes('href="/404/"'));
	}
});

test("upstream outages keep their error status and offer retry", async (t) => {
	apiStatus = 503;
	testClock += 60 * 60 * 1000 + 1;
	t.mock.method(Date, "now", () => testClock);
	try {
		for (const path of ["/999998/", "/", "/random/"]) {
			const response = await fetch(`${origin}${path}`);
			assert.equal(response.status, 503);
			assert.match(response.headers.get("content-type"), /text\/html/);
			const html = await response.text();
			assert.ok(html.includes("Comic unavailable"));
			assert.ok(html.includes(`href="${path}">Try again</a>`));
			assert.ok(html.includes('href="/">Latest comic</a>'));
		}
	} finally {
		apiStatus = 200;
	}
});
