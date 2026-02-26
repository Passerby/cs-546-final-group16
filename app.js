import { closeConnection, dbConnection } from './config/mongoConnection.js';

await dbConnection();
await closeConnection();
