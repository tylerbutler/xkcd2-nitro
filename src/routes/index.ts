export default eventHandler(async (event) => {
	setResponseHeader(event, "content-type", "text/html");
	const html = await renderComicPage();
	return html;
});
