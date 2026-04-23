import express from 'express';
import session from 'express-session';
import { engine } from 'express-handlebars';
import { dbConnection } from './config/mongoConnection.js';
import configRoutes from './routes/index.js';
import { exposeUser } from './middleware/auth.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// session
app.use(session({
  name: 'AuthCookie',
  secret: 'group16-not-very-secret',
  resave: false,
  saveUninitialized: false
}));

// handlebars
app.engine('handlebars', engine({
  defaultLayout: 'main',
  helpers: {
    eq: (a, b) => a === b,
    formatDate: (d) => d ? new Date(d).toLocaleString() : '',
    short: (s, n) => {
      if (!s) return '';
      n = n || 120;
      return s.length > n ? s.slice(0, n) + '...' : s;
    }
  }
}));
app.set('view engine', 'handlebars');
app.set('views', './views');

// put currentUser into every render
app.use(exposeUser);

configRoutes(app);

// 404
app.use((req, res) => {
  res.status(404).render('error', { title: 'not found', error: 'page not found' });
});

await dbConnection();
const PORT = 3000;
app.listen(PORT, () => {
  console.log('server running on port ' + PORT);
});
