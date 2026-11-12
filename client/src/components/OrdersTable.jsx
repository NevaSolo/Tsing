import { formatPrice } from "../lib/format";
import { OrderStatusBadge, Skeleton } from "./ui/feedback";

const formatDate = (value) => new Date(value).toLocaleDateString("fr-FR");

/**
 * Tableau générique : tableau classique sur desktop, liste de cartes sur mobile.
 * `columns` : [{ key, header, render(row), align? }]
 */
const OrdersTable = ({ rows, columns, loading, empty, caption }) => {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return empty;

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`py-3 pr-4 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 align-top">
                {columns.map((c) => (
                  <td key={c.key} className={`py-3 pr-4 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id} className="rounded-[var(--radius-control)] border border-border p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {columns.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-muted-foreground">{c.header}</dt>
                  <dd className="text-right">{c.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
};

export const orderColumns = {
  date: { key: "date", header: "Date", render: (r) => formatDate(r.created_at) },
  status: { key: "status", header: "Statut", render: (r) => <OrderStatusBadge status={r.status} label={r.status_display} /> },
  total: (key, header, field) => ({ key, header, align: "right", render: (r) => formatPrice(r[field]) }),
};

export default OrdersTable;
