import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/actions/logout";
import { navItems } from "@/lib/site-data";

import { NavLink } from "./nav-link";

type AppShellProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
};

export function AppShell({ title, eyebrow, children }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="eyebrow">LifeOps // Portal</p>
          <h1>Control grid for execution, context, and decisions.</h1>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link className="secondary-link" href="/ideas">
            Quick capture
          </Link>
          <form action={logoutAction}>
            <button className="secondary-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <div className="topbar-chip">Node // portal.devonwatkins.com</div>
        </header>
        {children}
      </main>
    </div>
  );
}
