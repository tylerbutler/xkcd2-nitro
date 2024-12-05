export default eventHandler(async (_event) => {
	const html = await renderComicPage();
	return html;
});
