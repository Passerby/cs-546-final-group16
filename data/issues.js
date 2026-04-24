import xss from 'xss';
import { v4 as uuid } from 'uuid';
import { issues as issuesColl, users as usersColl } from '../config/mongoCollections.js';

export const VALID_CATEGORIES = [
  'pothole', 'streetlight', 'sidewalk', 'trash',
  'traffic_signal', 'tree', 'graffiti', 'noise', 'housing', 'other'
];
const VALID_STATUS = ['open', 'in_progress', 'resolved'];

const checkStr = (s, name) => {
  if (typeof s !== 'string') throw `${name} must be string`;
  s = s.trim();
  if (!s) throw `${name} cant be empty`;
  return s;
};

const checkNum = (n, name) => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (typeof v !== 'number' || isNaN(v)) throw `${name} must be a number`;
  return v;
};

// lat/lng are optional now — return null if blank
const checkOptionalNum = (n, name) => {
  if (n === null || n === undefined || n === '') return null;
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (typeof v !== 'number' || isNaN(v)) throw `${name} must be a number`;
  return v;
};

// haversine distance in km
const distKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export const createIssue = async (data, opts = {}) => {
  const title = xss(checkStr(data.title, 'title'));
  const description = xss(checkStr(data.description, 'description'));
  const category = checkStr(data.category, 'category').toLowerCase();
  if (!VALID_CATEGORIES.includes(category)) throw 'invalid category';
  const address = xss(checkStr(data.address || ' ', 'address'));
  const lat = checkOptionalNum(data.lat, 'lat');
  const lng = checkOptionalNum(data.lng, 'lng');
  if (lat !== null && (lat < -90 || lat > 90)) throw 'lat out of range';
  if (lng !== null && (lng < -180 || lng > 180)) throw 'lng out of range';

  const source = opts.source || 'community';
  const moderationStatus = source === 'official' ? 'approved' : 'pending';
  const createdBy = opts.createdBy || null;

  const issue = {
    _id: opts._id || uuid(),
    title,
    description,
    category,
    location: { address, lat, lng },
    status: 'open',
    source,
    officialSourceId: opts.officialSourceId || null,
    createdBy,
    moderationStatus,
    linkedOfficialIssueId: null,
    upvotes: 0,
    followers: [],
    createdAt: opts.createdAt || new Date()
  };

  const coll = await issuesColl();
  await coll.insertOne(issue);

  // also push id to user's createdIssues
  if (createdBy) {
    const usersC = await usersColl();
    await usersC.updateOne({ _id: createdBy }, { $push: { createdIssues: issue._id } });
  }
  return issue;
};

export const getById = async (id) => {
  if (typeof id !== 'string') throw 'id required';
  const coll = await issuesColl();
  const i = await coll.findOne({ _id: id });
  if (!i) throw 'issue not found';
  return i;
};

export const list = async (params = {}) => {
  const { sort = 'date', category, status, source, q, includePending = false } = params;
  const coll = await issuesColl();
  const filt = {};
  if (!includePending) filt.moderationStatus = 'approved';
  if (category && category !== 'all') filt.category = category;
  if (status && status !== 'all') filt.status = status;
  if (source && source !== 'all') filt.source = source;
  if (q) filt.title = { $regex: q, $options: 'i' };

  let sortSpec = { createdAt: -1 };
  if (sort === 'upvotes') sortSpec = { upvotes: -1, createdAt: -1 };
  if (sort === 'category') sortSpec = { category: 1, createdAt: -1 };
  if (sort === 'status') sortSpec = { status: 1, createdAt: -1 };

  return await coll.find(filt).sort(sortSpec).limit(100).toArray();
};

export const listPending = async () => {
  const coll = await issuesColl();
  return await coll.find({ moderationStatus: 'pending' }).sort({ createdAt: -1 }).toArray();
};

export const update = async (id, data, currentUser) => {
  const cur = await getById(id);
  if (currentUser.role !== 'admin' && cur.createdBy !== currentUser._id) {
    throw 'not allowed';
  }
  const upd = {};
  if (data.title) upd.title = xss(checkStr(data.title, 'title'));
  if (data.description) upd.description = xss(checkStr(data.description, 'description'));
  if (data.category) {
    const c = checkStr(data.category, 'category').toLowerCase();
    if (!VALID_CATEGORIES.includes(c)) throw 'invalid category';
    upd.category = c;
  }
  if (data.status) {
    if (!VALID_STATUS.includes(data.status)) throw 'invalid status';
    upd.status = data.status;
  }
  if (data.address) upd['location.address'] = xss(checkStr(data.address, 'address'));
  if (data.lat !== undefined && data.lat !== '') upd['location.lat'] = checkNum(data.lat, 'lat');
  if (data.lng !== undefined && data.lng !== '') upd['location.lng'] = checkNum(data.lng, 'lng');

  const coll = await issuesColl();
  await coll.updateOne({ _id: id }, { $set: upd });
  return await getById(id);
};

export const remove = async (id, currentUser) => {
  const cur = await getById(id);
  if (currentUser.role !== 'admin' && cur.createdBy !== currentUser._id) {
    throw 'not allowed';
  }
  const coll = await issuesColl();
  await coll.deleteOne({ _id: id });
  if (cur.createdBy) {
    const usersC = await usersColl();
    await usersC.updateOne({ _id: cur.createdBy }, { $pull: { createdIssues: id } });
  }
  return { removed: true, id };
};

export const setModeration = async (id, status) => {
  if (!['approved', 'rejected', 'pending'].includes(status)) throw 'bad moderation status';
  const coll = await issuesColl();
  const r = await coll.updateOne({ _id: id }, { $set: { moderationStatus: status } });
  if (r.matchedCount === 0) throw 'issue not found';
  return await getById(id);
};

export const upvote = async (id) => {
  const coll = await issuesColl();
  const r = await coll.updateOne({ _id: id }, { $inc: { upvotes: 1 } });
  if (r.matchedCount === 0) throw 'issue not found';
  return await getById(id);
};

// dup check: same category, within 0.15 km, within 7 days
// if user didn't give us coords, we cant check geographic proximity, so skip
export const findDuplicates = async (category, lat, lng) => {
  if (lat === null || lat === undefined || isNaN(lat)) return [];
  if (lng === null || lng === undefined || isNaN(lng)) return [];

  const coll = await issuesColl();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const cands = await coll.find({
    category: String(category).toLowerCase(),
    moderationStatus: 'approved',
    createdAt: { $gte: since }
  }).toArray();

  const out = [];
  for (const c of cands) {
    if (typeof c.location?.lat !== 'number' || typeof c.location?.lng !== 'number') continue;
    const d = distKm(lat, lng, c.location.lat, c.location.lng);
    if (d <= 0.15) out.push({ ...c, distance: Number(d.toFixed(3)) });
  }
  out.sort((a, b) => a.distance - b.distance);
  return out.slice(0, 5);
};

export const trending = async (limit = 20) => {
  const coll = await issuesColl();
  return await coll.find({ moderationStatus: 'approved' })
    .sort({ upvotes: -1, createdAt: -1 })
    .limit(limit).toArray();
};
