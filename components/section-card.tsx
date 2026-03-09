import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  caption?: string;
  children: ReactNode;
};

export function SectionCard({ title, caption, children }: SectionCardProps) {
  return (
    <section className="section-card">
      <div className="section-heading">
        <h4>{title}</h4>
        {caption ? <p>{caption}</p> : null}
      </div>
      {children}
    </section>
  );
}

