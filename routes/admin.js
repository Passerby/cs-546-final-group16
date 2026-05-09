import { Router } from 'express';
import { listPending, setModeration, remove } from '../data/issues.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

router.get('/moderation', async (req, res) => {
  try {
    const pending = await listPending();
    res.render('admin/moderation', { title: 'admin moderation', pending });
  } catch (e) {
    res.status(500).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'load failed' });
  }
});

router.post('/moderation/:id/approve', async (req, res) => {
  try {
    await setModeration(req.params.id, 'approved');
    res.redirect('/admin/moderation');
  } catch (e) {
    res.status(400).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'approve failed' });
  }
});

router.post('/moderation/:id/reject', async (req, res) => {
  try {
    await setModeration(req.params.id, 'rejected');
    res.redirect('/admin/moderation');
  } catch (e) {
    res.status(400).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'reject failed' });
  }
});

router.post('/moderation/:id/delete', async (req, res) => {
  try {
    await remove(req.params.id, req.session.user);
    res.redirect('/admin/moderation');
  } catch (e) {
    res.status(400).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'delete failed' });
  }
});

export default router;
