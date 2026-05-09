import { v4 as uuid } from 'uuid';
import {
  follows as followsColl,
  users as usersColl,
  issues as issuesColl
} from '../config/mongoCollections.js';

export const follow = async (userId, issueId) => {
  if (!userId || !issueId) throw 'userId and issueId required';
  const fc = await followsColl();
  const existing = await fc.findOne({ userId, issueId });
  if (existing) return existing;

  const f = { _id: uuid(), userId, issueId, createdAt: new Date() };
  await fc.insertOne(f);

  // keep arrays in sync
  const usersC = await usersColl();
  await usersC.updateOne({ _id: userId }, { $addToSet: { followedIssues: issueId } });
  const issuesC = await issuesColl();
  await issuesC.updateOne({ _id: issueId }, { $addToSet: { followers: userId } });

  return f;
};

export const unfollow = async (userId, issueId) => {
  if (!userId || !issueId) throw 'userId and issueId required';
  const fc = await followsColl();
  await fc.deleteOne({ userId, issueId });

  const usersC = await usersColl();
  await usersC.updateOne({ _id: userId }, { $pull: { followedIssues: issueId } });
  const issuesC = await issuesColl();
  await issuesC.updateOne({ _id: issueId }, { $pull: { followers: userId } });

  return { unfollowed: true };
};

export const isFollowing = async (userId, issueId) => {
  if (!userId || !issueId) return false;
  const fc = await followsColl();
  const f = await fc.findOne({ userId, issueId });
  return !!f;
};

export const listByUser = async (userId) => {
  const fc = await followsColl();
  return await fc.find({ userId }).toArray();
};

export const listByIssue = async (issueId) => {
  const fc = await followsColl();
  return await fc.find({ issueId }).toArray();
};
