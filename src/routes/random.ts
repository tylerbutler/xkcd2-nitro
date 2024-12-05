export default defineEventHandler(async (event) => {
	const comicId = await getRandomComicId();
	return sendRedirect(event, `/${comicId}`);
});
