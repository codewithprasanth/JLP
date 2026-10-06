import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/prisma/client';
import { badRequest, conflict, notFound } from '../../shared/errors';
import { idParam } from '../../shared/validate';

export const adminCategoriesRouter = Router();

const nameField = z.string().trim().min(1).max(60);

adminCategoriesRouter.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { items: { where: { archivedAt: null } } } } },
  });
  res.json(categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder, itemCount: c._count.items })));
});

adminCategoriesRouter.post('/', async (req, res) => {
  const body = z.object({ name: nameField, sortOrder: z.number().int().min(0).optional() }).parse(req.body);
  const sortOrder =
    body.sortOrder ??
    ((await prisma.category.aggregate({ where: { archivedAt: null }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;
  res.status(201).json(await prisma.category.create({ data: { name: body.name, sortOrder } }));
});

/** Drag-and-drop reorder: the full ordered list of category ids. */
adminCategoriesRouter.put('/order', async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.uuid()).min(1).max(200) }).parse(req.body);
  if (new Set(ids).size !== ids.length) throw badRequest('Duplicate category ids');
  await prisma.$transaction(ids.map((id, index) => prisma.category.update({ where: { id }, data: { sortOrder: index } })));
  res.json({ success: true });
});

adminCategoriesRouter.patch('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z.object({ name: nameField.optional(), sortOrder: z.number().int().min(0).optional() }).parse(req.body);
  const { count } = await prisma.category.updateMany({ where: { id, archivedAt: null }, data: body });
  if (!count) throw notFound('Category not found');
  res.json(await prisma.category.findUniqueOrThrow({ where: { id } }));
});

adminCategoriesRouter.delete('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const activeItems = await prisma.menuItem.count({ where: { categoryId: id, archivedAt: null } });
  if (activeItems > 0) {
    throw conflict(`Move or delete the ${activeItems} item(s) in this category first`, 'CATEGORY_NOT_EMPTY');
  }
  const { count } = await prisma.category.updateMany({ where: { id, archivedAt: null }, data: { archivedAt: new Date() } });
  if (!count) throw notFound('Category not found');
  res.json({ success: true });
});
