export default eventHandler(async (event) => {
	setResponseHeader(event, "content-type", "text/html");
	const comicId = getRouterParam(event, "id");
	const html = await renderComicPage(comicId);
	return html;
});
