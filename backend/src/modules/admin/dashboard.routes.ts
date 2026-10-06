import { Router } from 'express';
import { prisma } from '../../shared/prisma/client';
import { istDayStart, istToday } from '../../shared/utils/time';
import { ACTIVE_STATUSES } from '../orders/order.service';
import { getSettings } from '../settings/settings.service';
import { salesReport } from './reports.service';

export const adminDashboardRouter = Router();

adminDashboardRouter.get('/summary', async (_req, res) => {
  const today = istToday();
  const [settings, pendingOrders, newOrders, todayReport] = await Promise.all([
    getSettings(),
    prisma.order.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.order.count({ where: { status: 'PLACED', adminViewedAt: null } }),
    salesReport(today, today),
  ]);
  const unpaidDelivered = await prisma.order.count({
    where: { status: 'DELIVERED', isPaid: false, createdAt: { gte: istDayStart(today) } },
  });

  res.json({
    date: today,
    todayOrders: todayReport.totalOrders,
    pendingOrders,
    newOrders,
    revenueToday: todayReport.totalRevenue,
    collectedToday: todayReport.collectedRevenue,
    unpaidDeliveredToday: unpaidDelivered,
    isAcceptingOrders: settings.isAcceptingOrders,
  });
});
