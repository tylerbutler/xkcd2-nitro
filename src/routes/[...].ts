/**
 * This is a catch-all route that will be used if other routes don't match.
 */
export default eventHandler((event) => {
	return sendRedirect(event, "/");
});
