import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../shared/prisma/client';
import { badRequest, notFound } from '../../shared/errors';
import { formBoolean, idParam, money } from '../../shared/validate';
import { deleteMenuImage, uploadMenuImage } from '../../shared/utils/cloudinary';
import { toMenuItemDto } from '../menu/menu.service';

export const adminMenuItemsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Image must be JPEG, PNG or WebP'));
  },
});

// Explicit whitelist — never spread req.body into Prisma.
const itemFields = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: z.uuid(),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
  price: money.refine((n) => n > 0, 'Price must be greater than 0'),
  isAvailable: formBoolean.default(true),
});

async function assertCategory(categoryId: string) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, archivedAt: null } });
  if (!category) throw badRequest('Category not found');
}

const withCategory = <T extends { category: { name: string } }>(item: T & Parameters<typeof toMenuItemDto>[0]) => ({
  ...toMenuItemDto(item),
  categoryName: item.category.name,
});

adminMenuItemsRouter.get('/', async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    where: { archivedAt: null },
    include: { category: true },
    orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
  });
  res.json(items.map(withCategory));
});

adminMenuItemsRouter.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const item = await prisma.menuItem.findFirst({ where: { id, archivedAt: null }, include: { category: true } });
  if (!item) throw notFound('Menu item not found');
  res.json(withCategory(item));
});

adminMenuItemsRouter.post('/', upload.single('image'), async (req, res) => {
  const body = itemFields.parse(req.body);
  await assertCategory(body.categoryId);

  const image = req.file ? await uploadMenuImage(req.file.buffer) : null;
  try {
    const item = await prisma.menuItem.create({
      data: { ...body, imageUrl: image?.imageUrl ?? null, cloudinaryPublicId: image?.publicId ?? null },
      include: { category: true },
    });
    res.status(201).json(withCategory(item));
  } catch (err) {
    await deleteMenuImage(image?.publicId); // don't orphan the upload
    throw err;
  }
});

adminMenuItemsRouter.patch('/:id', upload.single('image'), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = itemFields.partial().parse(req.body);
  const existing = await prisma.menuItem.findFirst({ where: { id, archivedAt: null } });
  if (!existing) throw notFound('Menu item not found');
  if (body.categoryId) await assertCategory(body.categoryId);

  // Upload the new image FIRST; only delete the old one once the DB points at the new one.
  const image = req.file ? await uploadMenuImage(req.file.buffer) : null;
  try {
    const item = await prisma.menuItem.update({
      where: { id },
      data: { ...body, ...(image ? { imageUrl: image.imageUrl, cloudinaryPublicId: image.publicId } : {}) },
      include: { category: true },
    });
    if (image) await deleteMenuImage(existing.cloudinaryPublicId);
    res.json(withCategory(item));
  } catch (err) {
    await deleteMenuImage(image?.publicId);
    throw err;
  }
});

adminMenuItemsRouter.patch('/:id/availability', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { isAvailable } = z.object({ isAvailable: z.boolean() }).parse(req.body);
  const { count } = await prisma.menuItem.updateMany({ where: { id, archivedAt: null }, data: { isAvailable } });
  if (!count) throw notFound('Menu item not found');
  res.json({ id, isAvailable });
});

/** Soft delete: past orders still reference the item (name/price are snapshotted). */
adminMenuItemsRouter.delete('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const existing = await prisma.menuItem.findFirst({ where: { id, archivedAt: null } });
  if (!existing) throw notFound('Menu item not found');
  await prisma.menuItem.update({
    where: { id },
    data: { archivedAt: new Date(), isAvailable: false, imageUrl: null, cloudinaryPublicId: null },
  });
  await deleteMenuImage(existing.cloudinaryPublicId);
  res.json({ success: true });
});
