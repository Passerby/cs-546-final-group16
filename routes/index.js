import authRoutes from './auth.js';
import issueRoutes from './issues.js';
import engageRoutes from './engage.js';
import adminRoutes from './admin.js';
import trendingRoutes from './trending.js';

const configRoutes = (app) => {
  app.use('/', issueRoutes);
  app.use('/', engageRoutes);
  app.use('/', trendingRoutes);
  app.use('/admin', adminRoutes);
  app.use('/', authRoutes);
};

export default configRoutes;
