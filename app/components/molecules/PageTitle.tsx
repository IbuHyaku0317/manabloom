type PageTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
  action?: React.ReactNode;
};

export function PageTitle({
  eyebrow,
  title,
  description,
  className = "",
  action,
}: PageTitleProps) {
  return (
    <div className={`page-title ${className}`.trim()}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
