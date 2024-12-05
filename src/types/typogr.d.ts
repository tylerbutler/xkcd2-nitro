export = typogr;
declare function typogr(obj: string): string;
// biome-ignore lint/style/noNamespace: namespaces are OK for type definitions
declare namespace typogr {
	function amp(text: string): string;
	function caps(text: string): string;
	function initQuotes(text: string): string;
	function ord(text: string): string;
	function smartBackticks(text: string): string;
	function smartDashes(text: string): string;
	function smartEllipses(text: string): string;
	function smartEscapes(text: string): string;
	function smartQuotes(text: string): string;
	function smartypants(text: string): string;
	function tokenize(text: string): string;
	function typogrify(src: string): string;
	const version: string;
	function widont(text: string): string;
}
