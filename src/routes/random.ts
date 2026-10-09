export default defineEventHandler(async (event) => {
	try {
		const comicId = await getRandomComicId();
		return sendRedirect(event, `/${comicId}`);
	} catch (error) {
		const { html, statusCode } = await renderComicErrorPage(
			error,
			getRequestURL(event).origin,
			"/random/",
		);
		setResponseHeader(event, "content-type", "text/html; charset=utf-8");
		setResponseStatus(event, statusCode);
		return html;
	}
});
