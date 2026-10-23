import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../src/models/User.js';
import ItemReport from '../../src/models/ItemReport.js';
import Claim from '../../src/models/Claim.js';
import Handover from '../../src/models/Handover.js';
import Conversation from '../../src/models/Conversation.js';
import Message from '../../src/models/Message.js';
import Notification from '../../src/models/Notification.js';
import AbuseReport from '../../src/models/AbuseReport.js';
import AuditLog from '../../src/models/AuditLog.js';

let mongod;

export async function startTestDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Make sure unique/text indexes exist before tests run
  await User.init();
  await ItemReport.init();
  await Claim.init();
  await Handover.init();
  await Conversation.init();
  await Message.init();
  await Notification.init();
  await AbuseReport.init();
  await AuditLog.init();
}

export async function clearTestDb() {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
}

export async function stopTestDb() {
  await mongoose.disconnect();
  await mongod?.stop();
}
