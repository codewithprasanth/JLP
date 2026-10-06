import { prisma } from '../../shared/prisma/client';
import { addDays, istDayStart } from '../../shared/utils/time';

/**
 * Definitions (keep the dashboard and the report consistent):
 *  - orders  = orders placed in the range, excluding CANCELLED
 *  - revenue = sum of total_amount for DELIVERED orders placed in the range
 *  - collected = revenue where the admin has marked cash as collected
 * Days are IST calendar days.
 */
interface DayRow {
  day: string;
  orders: number;
  cancelled: number;
  revenue: string;
  collected: string;
}

// created_at is a UTC "timestamp without time zone"; compare against UTC strings.
const utcLiteral = (d: Date) => d.toISOString().replace('Z', '');

export async function salesReport(fromDate: string, toDate: string) {
  const from = utcLiteral(istDayStart(fromDate));
  const to = utcLiteral(istDayStart(addDays(toDate, 1)));

  const rows = await prisma.$queryRaw<DayRow[]>`
    SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
           count(*) FILTER (WHERE status <> 'CANCELLED')::int AS orders,
           count(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
           coalesce(sum(total_amount) FILTER (WHERE status = 'DELIVERED'), 0)::text AS revenue,
           coalesce(sum(total_amount) FILTER (WHERE status = 'DELIVERED' AND is_paid), 0)::text AS collected
    FROM orders
    WHERE created_at >= ${from}::timestamp AND created_at < ${to}::timestamp
    GROUP BY 1
    ORDER BY 1`;

  const topItems = await prisma.$queryRaw<{ name: string; quantity: number; revenue: string }[]>`
    SELECT oi.item_name_snapshot AS name,
           sum(oi.quantity)::int AS quantity,
           sum(oi.quantity * oi.price_snapshot)::text AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'DELIVERED' AND o.created_at >= ${from}::timestamp AND o.created_at < ${to}::timestamp
    GROUP BY oi.item_name_snapshot
    ORDER BY quantity DESC
    LIMIT 5`;

  // Fill in days with no orders so charts have a continuous axis.
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const dailyBreakdown: DayRow[] = [];
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
    dailyBreakdown.push(byDay.get(d) ?? { day: d, orders: 0, cancelled: 0, revenue: '0', collected: '0' });
  }

  const sum = (key: 'revenue' | 'collected') => dailyBreakdown.reduce((acc, r) => acc + Number(r[key]), 0).toFixed(2);
  return {
    from: fromDate,
    to: toDate,
    totalOrders: dailyBreakdown.reduce((n, r) => n + r.orders, 0),
    cancelledOrders: dailyBreakdown.reduce((n, r) => n + r.cancelled, 0),
    totalRevenue: sum('revenue'),
    collectedRevenue: sum('collected'),
    dailyBreakdown: dailyBreakdown.map((r) => ({ ...r, revenue: Number(r.revenue).toFixed(2), collected: Number(r.collected).toFixed(2) })),
    topItems: topItems.map((t) => ({ ...t, revenue: Number(t.revenue).toFixed(2) })),
  };
}
