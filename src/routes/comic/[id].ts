export default defineEventHandler((event) => {
	const comicId = getRouterParam(event, "id");
	return sendRedirect(event, `/${comicId}`);
});
