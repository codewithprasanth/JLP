import { Router } from 'express';
import { addressesRouter } from './addresses.routes';
import { customerOrdersRouter } from './orders.routes';
import { profileRouter } from './profile.routes';

export const customerRouter = Router();

customerRouter.use('/profile', profileRouter);
customerRouter.use('/addresses', addressesRouter);
customerRouter.use('/orders', customerOrdersRouter);
