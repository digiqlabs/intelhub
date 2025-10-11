import { Activity, BarChart3, Compass, Factory, Globe2, Sparkles } from "lucide-react";
import Tile from "./Tile";

const tiles = [
	{
		title: "Wishlist pipeline",
		description: "Capture inspired products, assign owners, and track sourcing all the way to launch.",
		icon: Sparkles,
		href: "/wishlist",
	},
	{
		title: "Vendor CRM",
		description: "Log supplier intel, catalog links, and ratings so your sourcing stays organised.",
		icon: Factory,
		href: "/vendors",
	},
	{
		title: "Realtime intel",
		description: "Track follower shifts, channel health, and content cadence in one glance.",
		icon: Activity,
		href: "/competitors",
	},
	{
		title: "Commerce overview",
		description: "Surface storefront stack, delivery promises, and return policies instantly.",
		icon: Compass,
		href: "/competitors",
	},
	{
		title: "Marketing signals",
		description: "See newsletters, blogs, and hashtag strategy powering growth campaigns.",
		icon: BarChart3,
		href: "/competitors",
	},
	{
		title: "Traffic & SEO",
		description: "Blend DA, estimated visits, and top geos for quick channel prioritisation.",
		icon: Globe2,
		href: "/competitors",
	},
];

function Home({ summary }) {
	return (
		<section className="rounded-3xl bg-slate-950/60 px-8 py-14 ring-1 ring-slate-900/60 shadow-[0_45px_120px_-60px_rgba(15,23,42,0.85)] backdrop-blur-sm dark:bg-slate-950/40 dark:ring-slate-800/70">
			<div className="mx-auto flex max-w-4xl flex-col gap-10 text-center">
				<div className="space-y-6">
					<p className="font-semibold uppercase tracking-[0.7em] text-slate-400 dark:text-slate-300/80">
						IntelHub
					</p>
					<h1 className="text-4xl font-semibold leading-tight text-slate-100 sm:text-5xl dark:text-white">
						Competitive intelligence that feels effortless.
					</h1>
					<p className="text-lg text-slate-400 dark:text-slate-300/90">
						Monitor rival brands, social momentum, and commerce signals with an interface designed to stay
						out of your way.
					</p>
				</div>

				{summary && (
					<div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-300 dark:text-slate-200/90">
						<span className="rounded-full border border-slate-800/80 px-4 py-2 dark:border-slate-700">
							{summary.total} tracked brands
						</span>
						<span className="rounded-full border border-slate-800/80 px-4 py-2 dark:border-slate-700">
							Avg intel score {summary.avgIntelScore ?? 0}
						</span>
						{summary.topTag && (
							<span className="rounded-full border border-slate-800/80 px-4 py-2 dark:border-slate-700">
								Top tag #{summary.topTag}
							</span>
						)}
					</div>
				)}

				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{tiles.map((tile) => (
						<Tile key={tile.title} {...tile} />
					))}
				</div>
			</div>
		</section>
	);
}

export default Home;
