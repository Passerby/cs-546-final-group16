import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { users as usersColl } from '../config/mongoCollections.js';

const checkStr = (s, field) => {
  if (typeof s !== 'string') throw `${field} must be a string`;
  s = s.trim();
  if (s.length === 0) throw `${field} cant be empty`;
  return s;
};

const checkEmail = (e) => {
  e = checkStr(e, 'email').toLowerCase();
  // very loose check
  if (!e.includes('@') || !e.includes('.')) throw 'bad email';
  return e;
};

const checkPwd = (p) => {
  if (typeof p !== 'string') throw 'password must be a string';
  if (p.length < 6) throw 'password too short, min 6';
  return p;
};

export const register = async (firstName, lastName, email, password) => {
  firstName = checkStr(firstName, 'firstName');
  lastName = checkStr(lastName, 'lastName');
  email = checkEmail(email);
  password = checkPwd(password);

  const coll = await usersColl();
  const exist = await coll.findOne({ email });
  if (exist) throw 'email already in use';

  const hashed = await bcrypt.hash(password, 10);
  const u = {
    _id: uuid(),
    firstName,
    lastName,
    email,
    hashedPassword: hashed,
    role: 'user',
    createdIssues: [],
    followedIssues: [],
    createdAt: new Date()
  };
  await coll.insertOne(u);
  return { _id: u._id, firstName, lastName, email, role: 'user' };
};

export const login = async (email, password) => {
  email = checkEmail(email);
  password = checkPwd(password);
  const coll = await usersColl();
  const u = await coll.findOne({ email });
  if (!u) throw 'email or password incorrect';
  const ok = await bcrypt.compare(password, u.hashedPassword);
  if (!ok) throw 'email or password incorrect';
  return {
    _id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role
  };
};

export const getById = async (id) => {
  if (typeof id !== 'string') throw 'id required';
  const coll = await usersColl();
  const u = await coll.findOne({ _id: id });
  if (!u) throw 'user not found';
  return u;
};
