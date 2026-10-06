import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { MulterError } from 'multer';
import { ZodError, z } from 'zod';
import { HttpError } from '../errors';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: z.flattenError(err).fieldErrors });
  }
  if (err instanceof MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Already exists' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
