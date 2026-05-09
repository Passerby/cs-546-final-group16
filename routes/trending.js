import { Router } from 'express';
import { trending } from '../data/issues.js';

const router = Router();

router.get('/trending', async (req, res) => {
  try {
    const items = await trending(20);
    res.render('trending', { title: 'trending', items });
  } catch (e) {
    res.status(500).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'load failed' });
  }
});

export default router;
