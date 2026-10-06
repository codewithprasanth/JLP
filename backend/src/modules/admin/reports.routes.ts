import { Router } from 'express';
import { z } from 'zod';
import { badRequest } from '../../shared/errors';
import { addDays, istToday } from '../../shared/utils/time';
import { salesReport } from './reports.service';

export const adminReportsRouter = Router();

const isoDate = z.iso.date();

adminReportsRouter.get('/sales', async (req, res) => {
  const today = istToday();
  const q = z.object({ from: isoDate.optional(), to: isoDate.optional() }).parse(req.query);
  const to = q.to ?? today;
  const from = q.from ?? addDays(to, -6);
  if (from > to) throw badRequest('`from` must be on or before `to`');
  if (addDays(from, 366) < to) throw badRequest('Range cannot exceed one year');
  res.json(await salesReport(from, to));
});
