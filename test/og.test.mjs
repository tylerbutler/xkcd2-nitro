import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { build, createNitro } from "nitropack";

const comic = {
	num: 1,
	safe_title: 'A "quoted" title & comic',
	alt: "Don't we all.",
	img: "https://imgs.xkcd.com/comics/barrel_cropped_(1).jpg",
};
const longComic = { ...comic, num: 2, alt: "A long caption. ".repeat(30) };
let directory;
let nitro;
let server;
let origin;

before(async () => {
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
					const cachedAt = Date.now();
					await storage.setItem("comic:1", { comic, cachedAt });
					await storage.setItem("comic:2", { comic: longComic, cachedAt });
					await storage.setItem("latest", { comic, cachedAt });
				});
			`,
		},
	});
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
	});
}

for (const id of [1, 2]) {
	test(`/og/${id}.png returns a complete 1200x630 PNG`, async () => {
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
