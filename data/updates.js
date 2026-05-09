import xss from 'xss';
import { v4 as uuid } from 'uuid';
import { updates as updatesColl } from '../config/mongoCollections.js';

const checkStr = (s, name) => {
  if (typeof s !== 'string') throw `${name} must be string`;
  s = s.trim();
  if (!s) throw `${name} cant be empty`;
  return s;
};

export const addComment = async (issueId, userId, message) => {
  if (!issueId) throw 'issueId required';
  if (!userId) throw 'userId required';
  message = xss(checkStr(message, 'message'));
  if (message.length > 2000) throw 'message too long';

  const u = {
    _id: uuid(),
    issueId,
    userId,
    message,
    createdAt: new Date()
  };
  const coll = await updatesColl();
  await coll.insertOne(u);
  return u;
};

export const listByIssue = async (issueId) => {
  const coll = await updatesColl();
  return await coll.find({ issueId }).sort({ createdAt: 1 }).toArray();
};
