export default eventHandler(
	async (event) => {
		const comicId = getRouterParam(event, "id");
		const html = await renderComicPage(comicId);
		return html;
	},
	// { maxAge: 60 * 60 /* 1 hour */ },
);
