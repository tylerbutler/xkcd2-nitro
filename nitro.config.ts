// https://nitro.unjs.io/config
export default defineNitroConfig({
	rootDir: ".",
	srcDir: "src",
	scanDirs: [], // defaults to srcDir when empty array: https://nitro.build/config#scandirs
	compatibilityDate: "2024-12-03",
	routeRules: {
		"/assets/**": { headers: { "cache-control": "s-maxage=0" } },
		"/about": { redirect: "https://tylerbutler.com/projects/xkcd2/" },
	},
	serveStatic: true,
	serverAssets: [
		{
			baseName: "templates",
			dir: "./templates",
		},
	],
	storage: {
		xkcd: {
			driver: "vercelKV",
			// Uses KV_REST_API_URL and KV_REST_API_TOKEN environment variables
		},
	},
});
