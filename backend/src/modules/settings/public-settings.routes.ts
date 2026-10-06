import { Router } from 'express';
import { getPublicSettings } from './settings.service';

export const publicSettingsRouter = Router();

publicSettingsRouter.get('/public', async (_req, res) => {
  res.json(await getPublicSettings());
});
