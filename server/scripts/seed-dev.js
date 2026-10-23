// DEVELOPMENT DATA ONLY. Creates demo users and a few reports so the app is not empty when you demo it.
//   npm run seed          (from /server, with MONGODB_URI set in .env)
// Safe to run twice: existing demo accounts are left alone. Refuses to run when NODE_ENV=production.
import bcrypt from 'bcryptjs';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import ItemReport from '../src/models/ItemReport.js';

const PASSWORD = process.env.DEMO_PASSWORD || 'Demo@12345';
const daysAgo = (n) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return d; };

const USERS = [
  { name: 'Asha Verma', email: 'asha.demo@example.com' },
  { name: 'Ravi Kumar', email: 'ravi.demo@example.com' },
  { name: 'Maria Lopez', email: 'maria.demo@example.com' },
  { name: 'Demo Admin', email: 'admin.demo@example.com', role: 'ADMIN' },
];

const ITEMS = [
  // A matching pair: Asha lost a wallet that Ravi found
  { by: 'asha', type: 'LOST', title: 'Black leather wallet', category: 'WALLETS_PURSES', description: 'Black leather wallet with a metal clip, lost near the central library entrance.', location: 'Central library', ago: 3 },
  { by: 'ravi', type: 'FOUND', title: 'Black wallet', category: 'WALLETS_PURSES', description: 'Found a black leather wallet on a bench outside the library.', location: 'Library entrance', ago: 2,
    privateDetails: 'Contains a student card and a blue metro pass.',
    verificationQuestions: [{ question: 'Which card is on top inside the wallet?', expectedAnswer: 'Student card' }, { question: 'What colour is the lining?', expectedAnswer: 'Red' }] },
  { by: 'maria', type: 'LOST', title: 'Silver house keys with a green tag', category: 'KEYS', description: 'Three keys on a ring with a green plastic tag, lost between the hostel and the canteen.', location: 'Hostel B', ago: 5 },
  { by: 'ravi', type: 'FOUND', title: 'Blue umbrella', category: 'ACCESSORIES', description: 'Folding blue umbrella left on the bus stop seat.', location: 'Main gate bus stop', ago: 4,
    verificationQuestions: [{ question: 'What is printed on the handle?', expectedAnswer: 'A small star' }] },
  { by: 'asha', type: 'LOST', title: 'Data structures textbook', category: 'BOOKS_STATIONERY', description: 'Hardcover data structures textbook with my name inside the front cover.', location: 'Block C classroom', ago: 6 },
  { by: 'maria', type: 'FOUND', title: 'Wireless earbuds case', category: 'ELECTRONICS', description: 'White earbuds charging case found in the computer lab.', location: 'Computer lab', ago: 1,
    verificationQuestions: [{ question: 'What sticker is on the case?', expectedAnswer: 'A cat' }] },
  { by: 'ravi', type: 'LOST', title: 'Grey hoodie', category: 'CLOTHING', description: 'Grey zip hoodie, size M, left in the sports ground changing room.', location: 'Sports ground', ago: 7 },
  { by: 'asha', type: 'FOUND', title: 'ID card holder', category: 'ID_DOCUMENTS', description: 'A lanyard with an ID card holder found near the admin office.', location: 'Admin office', ago: 2,
    verificationQuestions: [{ question: 'What department is printed on the card?', expectedAnswer: 'Civil engineering' }] },
];

async function main() {
  if (config.isProduction) throw new Error('Refusing to seed demo data when NODE_ENV=production');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (see server/.env.example)');
  await connectDB();

  const hash = await bcrypt.hash(PASSWORD, config.bcryptRounds);
  const ids = {};
  for (const u of USERS) {
    let doc = await User.findOne({ email: u.email });
    if (!doc) doc = await User.create({ name: u.name, email: u.email, passwordHash: hash, role: u.role || 'USER' });
    ids[u.email.split('.')[0]] = doc._id;
  }

  let created = 0;
  for (const i of ITEMS) {
    const exists = await ItemReport.exists({ createdBy: ids[i.by], title: i.title });
    if (exists) continue;
    await ItemReport.create({
      type: i.type, title: i.title, category: i.category, description: i.description, location: i.location,
      dateOccurred: daysAgo(i.ago), createdBy: ids[i.by], privateDetails: i.privateDetails || '', verificationQuestions: i.verificationQuestions || [],
    });
    created += 1;
  }
  console.log(`Demo data ready (${created} new reports). All demo accounts use the password: ${PASSWORD}`);
  console.log(USERS.map((u) => `  ${u.email}${u.role === 'ADMIN' ? '  (admin)' : ''}`).join('\n'));
}

main()
  .catch((err) => { console.error(`Failed: ${err.message}`); process.exitCode = 1; })
  .finally(disconnectDB);
