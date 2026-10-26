interface Props {
  price: number;
  base_price?: number | null;
  sale_price?: number | null;
  lowest_price_30d?: number | null;
  compact?: boolean;
}

const fmt = (n: number) => `${Number(n).toFixed(2)} €`;

const ServicePrices = ({ price, base_price, sale_price, lowest_price_30d, compact }: Props) => {
  const hasSale = sale_price !== null && sale_price !== undefined;
  const rows: [string, number, boolean?][] = [];
  if (base_price !== null && base_price !== undefined) rows.push(["Bazna cijena (10.09.2026.)", base_price]);
  rows.push(["Trenutna cijena", price, !hasSale]);
  if (hasSale) {
    rows.push(["Akcijska cijena", sale_price!, true]);
    if (lowest_price_30d !== null && lowest_price_30d !== undefined)
      rows.push(["Najniža cijena u zadnjih 30 dana", lowest_price_30d]);
  }
  return (
    <div className={compact ? "space-y-0.5 text-xs" : "space-y-1 text-sm"}>
      {rows.map(([label, value, strong]) => (
        <div key={label} className="flex justify-between gap-3">
          <span className="text-muted-foreground">{label}</span>
          <span className={strong ? "font-semibold text-primary" : hasSale && label === "Trenutna cijena" ? "line-through text-muted-foreground" : ""}>
            {fmt(value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ServicePrices;
