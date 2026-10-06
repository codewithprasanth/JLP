import type { MenuItem } from '../../generated/prisma/client';
import { prisma } from '../../shared/prisma/client';
import { notFound } from '../../shared/errors';

export function toMenuItemDto(item: MenuItem) {
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    price: item.price.toFixed(2),
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable,
  };
}

export async function listPublicCategories() {
  return prisma.category.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, sortOrder: true },
  });
}

export async function listPublicItems(categoryId?: string) {
  const items = await prisma.menuItem.findMany({
    where: { archivedAt: null, category: { archivedAt: null }, ...(categoryId ? { categoryId } : {}) },
    orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
  });
  return items.map(toMenuItemDto);
}

export async function getPublicItem(id: string) {
  const item = await prisma.menuItem.findFirst({ where: { id, archivedAt: null } });
  if (!item) throw notFound('Menu item not found');
  return toMenuItemDto(item);
}
