export default eventHandler(async (event) => {
	setResponseHeader(event, "content-type", "text/html; charset=utf-8");
	const comicId = getRouterParam(event, "id");
	const { html, statusCode } = await getComicPageResponse(
		comicId,
		getRequestURL(event).origin,
	);
	setResponseStatus(event, statusCode);
	return html;
});
