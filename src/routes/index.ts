export default eventHandler(async (event) => {
	setResponseHeader(event, "content-type", "text/html; charset=utf-8");
	const { html, statusCode } = await getComicPageResponse(
		undefined,
		getRequestURL(event).origin,
	);
	setResponseStatus(event, statusCode);
	return html;
});
