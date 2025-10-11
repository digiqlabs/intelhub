import { Link } from "react-router-dom";

function Tile({ icon: Icon, title, description, href, children }) {
  const className =
    "group block rounded-2xl bg-slate-900/60 p-6 ring-1 ring-slate-800/80 transition duration-200 ease-out hover:-translate-y-1 hover:bg-slate-900/80 hover:ring-emerald-400/50 dark:bg-slate-900/40 dark:ring-slate-700/80";

  const content = (
    <div className="flex items-start gap-4">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-emerald-300 shadow-inner shadow-slate-950/60 group-hover:text-emerald-200 dark:bg-slate-950/60">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 dark:text-slate-50">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-slate-400 dark:text-slate-300/80">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );

  if (href) {
    if (href.startsWith("/")) {
      return (
        <Link to={href} className={className}>
          {content}
        </Link>
      );
    }

    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}

export default Tile;
