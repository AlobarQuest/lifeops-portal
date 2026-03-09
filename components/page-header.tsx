type PageHeaderProps = {
  title: string;
  description: string;
  actionLabel?: string;
};

export function PageHeader({ title, description, actionLabel }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {actionLabel ? <button className="primary-button">{actionLabel}</button> : null}
    </div>
  );
}

