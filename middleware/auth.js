// expose currentUser to every render
export const exposeUser = (req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
};

export const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('error', { title: 'forbiddn', error: 'admin only' });
  }
  next();
};
