import { Router } from 'express';
import xss from 'xss';
import {
  createIssue, getById, list, update, remove,
  upvote, findDuplicates, VALID_CATEGORIES
} from '../data/issues.js';
import { listByIssue as listComments } from '../data/updates.js';
import { isFollowing } from '../data/follows.js';
import { getById as getUserById } from '../data/users.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// dashboard
router.get('/', async (req, res) => {
  try {
    const sort = req.query.sort || 'date';
    const category = req.query.category || 'all';
    const status = req.query.status || 'all';
    const source = req.query.source || 'all';
    const q = req.query.q ? xss(String(req.query.q)) : '';
    const items = await list({ sort, category, status, source, q });
    res.render('home', {
      title: 'dashboard',
      items,
      sort, category, status, source, q,
      categories: VALID_CATEGORIES
    });
  } catch (e) {
    console.log('dashboard err', e);
    res.status(500).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'error loading dashboard' });
  }
});

// new issue form
router.get('/issues/new', requireAuth, (req, res) => {
  res.render('issueForm', { title: 'report an issue', categories: VALID_CATEGORIES });
});

// create
router.post('/issues/new', requireAuth, async (req, res) => {
  try {
    const data = {
      title: xss(req.body.title || ''),
      description: xss(req.body.description || ''),
      category: req.body.category,
      address: xss(req.body.address || ''),
      lat: req.body.lat ? parseFloat(req.body.lat) : null,
      lng: req.body.lng ? parseFloat(req.body.lng) : null
    };

    // dup check unless user clicked "create anyway"
    if (!req.body.force) {
      const dups = await findDuplicates(data.category, data.lat, data.lng);
      if (dups.length > 0) {
        return res.render('dupCheck', {
          title: 'similar issues',
          dups,
          formData: data
        });
      }
    }

    const issue = await createIssue(data, {
      source: 'community',
      createdBy: req.session.user._id
    });
    res.redirect('/issues/' + issue._id);
  } catch (e) {
    res.status(400).render('issueForm', {
      title: 'report an issue',
      error: typeof e === 'string' ? e : 'failed to create',
      categories: VALID_CATEGORIES,
      title_v: req.body.title,
      description: req.body.description,
      category: req.body.category,
      address: req.body.address,
      lat: req.body.lat,
      lng: req.body.lng
    });
  }
});

// detail page (loads comments + follow state)
router.get('/issues/:id', async (req, res) => {
  try {
    const issue = await getById(req.params.id);
    const comments = await listComments(req.params.id);

    // attach author display name to each comment
    for (const c of comments) {
      try {
        const u = await getUserById(c.userId);
        c.authorName = u.firstName + ' ' + u.lastName;
      } catch {
        c.authorName = 'unknown';
      }
    }

    let following = false;
    if (req.session.user) {
      following = await isFollowing(req.session.user._id, req.params.id);
    }

    res.render('issueDetail', { title: issue.title, issue, comments, following });
  } catch (e) {
    res.status(404).render('error', { title: 'not found', error: 'issue not found' });
  }
});

// edit form
router.get('/issues/:id/edit', requireAuth, async (req, res) => {
  try {
    const issue = await getById(req.params.id);
    if (req.session.user.role !== 'admin' && issue.createdBy !== req.session.user._id) {
      return res.status(403).render('error', { title: 'forbiddn', error: 'cant edit this' });
    }
    res.render('issueForm', { title: 'edit issue', issue, edit: true, categories: VALID_CATEGORIES });
  } catch (e) {
    res.status(404).render('error', { title: 'not found', error: 'issue not found' });
  }
});

// update
router.post('/issues/:id/edit', requireAuth, async (req, res) => {
  try {
    const data = {
      title: xss(req.body.title || ''),
      description: xss(req.body.description || ''),
      category: req.body.category,
      status: req.body.status,
      address: xss(req.body.address || ''),
      lat: req.body.lat,
      lng: req.body.lng
    };
    await update(req.params.id, data, req.session.user);
    res.redirect('/issues/' + req.params.id);
  } catch (e) {
    res.status(400).render('error', {
      title: 'oops',
      error: typeof e === 'string' ? e : 'update failed'
    });
  }
});

// delete
router.post('/issues/:id/delete', requireAuth, async (req, res) => {
  try {
    await remove(req.params.id, req.session.user);
    res.redirect('/');
  } catch (e) {
    res.status(400).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'delete failed' });
  }
});

// upvote
router.post('/issues/:id/upvote', async (req, res) => {
  try {
    await upvote(req.params.id);
    res.redirect('/issues/' + req.params.id);
  } catch (e) {
    res.status(400).render('error', { title: 'oops', error: typeof e === 'string' ? e : 'upvote failed' });
  }
});

export default router;
