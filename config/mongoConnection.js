import { MongoClient } from 'mongodb';
import { mongoConfig } from './settings.js';

let _connection;
let _db;

export const dbConnection = async () => {
  // connct once
  if (!_connection) {
    _connection = await MongoClient.connect(mongoConfig.serverUrl);
    _db = _connection.db(mongoConfig.database);
  }

  return _db;
};

export const closeConnection = async () => {
  if (_connection) {
    await _connection.close();
    _connection = undefined;
    _db = undefined;
  }
};
