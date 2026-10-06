import { Router } from 'express';
import { z } from 'zod';
import { idParam } from '../../shared/validate';
import { getPublicItem, listPublicCategories, listPublicItems } from './menu.service';

export const publicMenuRouter = Router();

publicMenuRouter.get('/categories', async (_req, res) => {
  res.json(await listPublicCategories());
});

publicMenuRouter.get('/items', async (req, res) => {
  const { categoryId } = z.object({ categoryId: z.uuid().optional() }).parse(req.query);
  res.json(await listPublicItems(categoryId));
});

publicMenuRouter.get('/items/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await getPublicItem(id));
});
