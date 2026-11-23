import type { APIRoute } from "astro";
import { things, notes } from "../data/content";

// Built at deploy time from the same lists that feed the site, so new Things / Notes are included automatically.
export const GET: APIRoute = ({ site }) => {
	const paths = [
		"/",
		"/about",
		"/things",
		"/notes",
		...things.map((e) => e.href),
		...notes.map((e) => e.href),
		"/things/goal/privacy/",
		"/things/goal/terms/",
		"/privacy",
	];
	const urls = [...new Set(paths)].map((p) => `\t<url><loc>${new URL(p, site).href}</loc></url>`).join("\n");
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
	return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
