import { dbConnection } from './mongoConnection.js';

// returns a getter that caches the collection ref
const getColl = (name) => {
  let _coll = undefined;
  return async () => {
    if (!_coll) {
      const db = await dbConnection();
      _coll = db.collection(name);
    }
    return _coll;
  };
};

export const users = getColl('users');
export const issues = getColl('issues');
export const follows = getColl('follows');
export const updates = getColl('updates');
