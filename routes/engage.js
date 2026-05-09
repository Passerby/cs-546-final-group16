import { Router } from 'express';
import xss from 'xss';
import { follow, unfollow } from '../data/follows.js';
import { addComment } from '../data/updates.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/issues/:id/follow', requireAuth, async (req, res) => {
  try {
    await follow(req.session.user._id, req.params.id);
    res.redirect('/issues/' + req.params.id);
  } catch (e) {
    console.log('follow err', e);
    res.status(400).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'follow failed' });
  }
});

router.post('/issues/:id/unfollow', requireAuth, async (req, res) => {
  try {
    await unfollow(req.session.user._id, req.params.id);
    res.redirect('/issues/' + req.params.id);
  } catch (e) {
    res.status(400).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'unfollow failed' });
  }
});

router.post('/issues/:id/comments', requireAuth, async (req, res) => {
  try {
    const msg = xss(req.body.message || '');
    await addComment(req.params.id, req.session.user._id, msg);
    res.redirect('/issues/' + req.params.id);
  } catch (e) {
    res.status(400).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'comment failed' });
  }
});

export default router;
