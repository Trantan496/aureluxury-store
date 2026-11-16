import Link from "next/link";
import type { ReactNode } from "react";
export function ActionLink({ href, children, secondary = false, reload = false }: { href: string; children: ReactNode; secondary?: boolean; reload?: boolean }) {
  const className = `button ${secondary ? "button-secondary" : ""}`;
  const content = <>{children}<span aria-hidden="true">↗</span></>;
  // A full request retries the server data reader even when the URL is unchanged.
  if (reload) return <a className={className} href={href}>{content}</a>;
  return <Link className={className} href={href}>{content}</Link>;
}
