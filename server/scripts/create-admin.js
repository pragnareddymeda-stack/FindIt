// Provision (or promote) the initial administrator. Run from /server:
//   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" npm run create-admin
// The password is read from ADMIN_PASSWORD, or typed at a hidden prompt if unset.
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import { registerSchema } from '../src/validators/auth.js';

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (see server/.env.example)');
  const name = process.env.ADMIN_NAME || 'Administrator';
  const email = process.env.ADMIN_EMAIL;
  if (!email) throw new Error('Set ADMIN_EMAIL, e.g. ADMIN_EMAIL=you@example.com npm run create-admin');

  await connectDB();
  const existing = await User.findOne({ email: email.trim().toLowerCase() });
  if (existing) {
    existing.role = 'ADMIN';
    existing.status = 'ACTIVE';
    await existing.save();
    console.log(`Existing account ${existing.email} is now an ADMIN. Its password was not changed.`);
    return;
  }

  const password = process.env.ADMIN_PASSWORD || (await promptHidden('Admin password: '));
  const parsed = registerSchema.safeParse({ name, email, password });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, config.bcryptRounds);
  const admin = await User.create({ name: parsed.data.name, email: parsed.data.email, passwordHash, role: 'ADMIN' });
  console.log(`Admin account created for ${admin.email}.`);
}

main()
  .catch((err) => { console.error(`Failed: ${err.message}`); process.exitCode = 1; })
  .finally(disconnectDB);
