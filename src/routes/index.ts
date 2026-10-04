export default eventHandler(async (event) => {
	setResponseHeader(event, "content-type", "text/html");
	const html = await renderComicPage(undefined, getRequestURL(event).origin);
	return html;
});
