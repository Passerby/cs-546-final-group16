import { promises as fs } from 'fs';
import { v4 as uuid } from 'uuid';
import { issues as issuesColl } from '../config/mongoCollections.js';
import { closeConnection } from '../config/mongoConnection.js';

const JC_LIMIT = 500;
const NYC_LIMIT = 1500;

// small hand-rolled csv parser, handles quoted fields w/ commas + escaped quotes
const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQ = true;
      } else if (ch === ',') {
        row.push(cur);
        cur = '';
      } else if (ch === '\n') {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else if (ch === '\r') {
        // skip
      } else {
        cur += ch;
      }
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
};

const normalizeCategory = (raw) => {
  if (!raw) return 'other';
  const s = String(raw).toLowerCase();
  if (s.includes('pothole') || s.includes('street condition')) return 'pothole';
  if (s.includes('light')) return 'streetlight';
  if (s.includes('sidewalk')) return 'sidewalk';
  if (s.includes('trash') || s.includes('sanitation') || s.includes('dirty')) return 'trash';
  if (s.includes('traffic signal')) return 'traffic_signal';
  if (s.includes('tree')) return 'tree';
  if (s.includes('graffiti')) return 'graffiti';
  if (s.includes('noise')) return 'noise';
  if (s.includes('housing') || s.includes('code')) return 'housing';
  return 'other';
};

const mapJcStatus = (s) => {
  if (!s) return 'open';
  s = String(s).toLowerCase();
  if (s.includes('closed') || s.includes('acknowledged') || s.includes('resolved')) return 'resolved';
  if (s.includes('in progress')) return 'in_progress';
  return 'open';
};

const mapNycStatus = (s) => {
  if (!s) return 'open';
  s = String(s).toLowerCase();
  if (s === 'closed' || s.includes('resolved')) return 'resolved';
  if (s.includes('in progress') || s.includes('pending') || s.includes('assigned')) return 'in_progress';
  return 'open';
};

// parse like "06/03/2016 - 02:39PM"
const parseJcDate = (s) => {
  if (!s) return new Date();
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2}):(\d{2})(AM|PM)/i);
  if (!m) return new Date();
  let hh = parseInt(m[4], 10);
  const ampm = m[6].toUpperCase();
  if (ampm === 'PM' && hh !== 12) hh += 12;
  if (ampm === 'AM' && hh === 12) hh = 0;
  return new Date(
    parseInt(m[3]),
    parseInt(m[1]) - 1,
    parseInt(m[2]),
    hh,
    parseInt(m[5])
  );
};

const rowToObj = (header, row) => {
  const o = {};
  for (let i = 0; i < header.length; i++) o[header[i]] = row[i] || '';
  return o;
};

const importJerseyCity = async (coll, limit) => {
  const path = './seed-data/jersey-city-seeclickfix.csv';
  const text = await fs.readFile(path, 'utf8');
  const rows = parseCSV(text);
  const header = rows[0];
  console.log('jc rows total', rows.length - 1);

  const dataRows = rows.slice(1, 1 + limit);
  const docs = [];

  for (const r of dataRows) {
    const o = rowToObj(header, r);
    const lat = parseFloat(o['Lat']);
    const lng = parseFloat(o['Lng']);
    if (isNaN(lat) || isNaN(lng)) continue;

    const officialId = String(o['Id'] || '').trim();
    if (!officialId) continue;

    docs.push({
      _id: uuid(),
      title: (o['Summary'] || '').trim().slice(0, 200) || 'untitled jc issue',
      description: (o['Description'] || '').trim() || (o['Summary'] || '').trim(),
      category: normalizeCategory(o['Category'] || o['Request type']),
      location: {
        address: (o['Address'] || '').trim(),
        lat,
        lng
      },
      status: mapJcStatus(o['Status']),
      source: 'official',
      officialSourceId: 'jc-' + officialId,
      createdBy: null,
      moderationStatus: 'approved',
      linkedOfficialIssueId: null,
      upvotes: 0,
      followers: [],
      createdAt: parseJcDate(o['Created at local'])
    });
  }

  if (!docs.length) return 0;
  const ops = docs.map(d => ({
    updateOne: {
      filter: { officialSourceId: d.officialSourceId },
      update: { $setOnInsert: d },
      upsert: true
    }
  }));
  const r = await coll.bulkWrite(ops);
  return r.upsertedCount || 0;
};

const importNyc = async (coll, limit) => {
  const path = './seed-data/nyc-311-recent.json';
  const text = await fs.readFile(path, 'utf8');
  const arr = JSON.parse(text);
  console.log('nyc records total', arr.length);

  const slice = arr.slice(0, limit);
  const docs = [];
  for (const r of slice) {
    const lat = parseFloat(r.latitude);
    const lng = parseFloat(r.longitude);
    if (isNaN(lat) || isNaN(lng)) continue;

    const officialId = String(r.unique_key || '').trim();
    if (!officialId) continue;

    const titleBase = r.descriptor || r.complaint_type || 'untitled';
    const desc = r.resolution_description ||
      ((r.complaint_type || '') + ' at ' + (r.incident_address || ''));

    docs.push({
      _id: uuid(),
      title: String(titleBase).trim().slice(0, 200),
      description: String(desc).trim(),
      category: normalizeCategory(r.complaint_type),
      location: {
        address: [r.incident_address, r.borough].filter(Boolean).join(', '),
        lat,
        lng
      },
      status: mapNycStatus(r.status),
      source: 'official',
      officialSourceId: 'nyc-' + officialId,
      createdBy: null,
      moderationStatus: 'approved',
      linkedOfficialIssueId: null,
      upvotes: 0,
      followers: [],
      createdAt: r.created_date ? new Date(r.created_date) : new Date()
    });
  }

  if (!docs.length) return 0;
  const ops = docs.map(d => ({
    updateOne: {
      filter: { officialSourceId: d.officialSourceId },
      update: { $setOnInsert: d },
      upsert: true
    }
  }));
  const r = await coll.bulkWrite(ops);
  return r.upsertedCount || 0;
};

const main = async () => {
  const coll = await issuesColl();
  console.log('importing jersey city...');
  const jcN = await importJerseyCity(coll, JC_LIMIT);
  console.log('jc upserted:', jcN);
  console.log('importing nyc 311...');
  const nycN = await importNyc(coll, NYC_LIMIT);
  console.log('nyc upserted:', nycN);
  console.log('done. total upserted:', jcN + nycN);
  await closeConnection();
};

main().catch(err => {
  console.error('import failed', err);
  process.exit(1);
});
