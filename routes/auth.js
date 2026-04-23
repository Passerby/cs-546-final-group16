import { Router } from 'express';
import xss from 'xss';
import { register, login } from '../data/users.js';

const router = Router();

router.get('/signup', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('signup', { title: 'sign up' });
});

router.post('/signup', async (req, res) => {
  try {
    const fn = xss(req.body.firstName || '');
    const ln = xss(req.body.lastName || '');
    const em = xss(req.body.email || '');
    const pw = req.body.password || '';
    const u = await register(fn, ln, em, pw);
    req.session.user = u;
    res.redirect('/');
  } catch (e) {
    res.status(400).render('signup', {
      title: 'sign up',
      error: typeof e === 'string' ? e : 'something went wrong',
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email
    });
  }
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'login' });
});

router.post('/login', async (req, res) => {
  try {
    const em = xss(req.body.email || '');
    const pw = req.body.password || '';
    const u = await login(em, pw);
    req.session.user = u;
    res.redirect('/');
  } catch (e) {
    res.status(400).render('login', {
      title: 'login',
      error: typeof e === 'string' ? e : 'something went wrong',
      email: req.body.email
    });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

export default router;
