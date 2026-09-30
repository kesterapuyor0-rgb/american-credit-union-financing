import mongoose from 'mongoose';

let connection: Promise<typeof mongoose> | undefined;

export function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  const uri = process.env.MONGODB_URI;
  if (!uri) return Promise.reject(new Error('MONGODB_URI is required.'));
  if (!connection) {
    connection = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 20,
    }).catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
  }
  return connection;
}
