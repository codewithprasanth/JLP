import { Router } from 'express';
import { adminCategoriesRouter } from './categories.routes';
import { adminDashboardRouter } from './dashboard.routes';
import { adminMenuItemsRouter } from './menu-items.routes';
import { adminOrdersRouter } from './orders.routes';
import { adminReportsRouter } from './reports.routes';
import { adminSettingsRouter } from './settings.routes';

export const adminRouter = Router();

adminRouter.use('/dashboard', adminDashboardRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/menu/items', adminMenuItemsRouter);
adminRouter.use('/menu/categories', adminCategoriesRouter);
adminRouter.use('/settings', adminSettingsRouter);
adminRouter.use('/reports', adminReportsRouter);
