import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/prisma/client';
import { indianPhone } from '../../shared/validate';

export const profileRouter = Router();

const select = { id: true, email: true, name: true, phone: true } as const;

profileRouter.get('/', async (req, res) => {
  res.json(await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select }));
});

/**
 * Name and contact phone are editable. Email is the verified login identity and is
 * not editable here — changing it would need a fresh OTP to the new address.
 */
profileRouter.patch('/', async (req, res) => {
  const body = z
    .object({
      name: z.string().trim().min(1, 'Name is required').max(80).optional(),
      phone: indianPhone.optional(), // contact for delivery — not verified, not unique
    })
    .strict()
    .parse(req.body);
  res.json(await prisma.user.update({ where: { id: req.user!.id }, data: body, select }));
});
