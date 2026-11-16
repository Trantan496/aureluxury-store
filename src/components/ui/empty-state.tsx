import { ActionLink } from "./action-link";
export function EmptyState({ title, description, href, action, symbol = "◇", reload = false }: { title: string; description: string; href: string; action: string; symbol?: string; reload?: boolean }) {
  return <div className="empty-state"><span className="empty-symbol" aria-hidden="true">{symbol}</span><h2>{title}</h2><p>{description}</p><ActionLink href={href} secondary reload={reload}>{action}</ActionLink></div>;
}
