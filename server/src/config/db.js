import mongoose from 'mongoose';

export async function connectDB(uri = process.env.MONGODB_URI) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

const STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

export function dbStatus() {
  return STATES[mongoose.connection.readyState] ?? 'unknown';
}
