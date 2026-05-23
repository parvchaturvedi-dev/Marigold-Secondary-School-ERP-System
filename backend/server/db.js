import mongoose from 'mongoose';

let dbStatus = 'disconnected';

export const connectMongo = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    dbStatus = 'missing-uri';
    console.warn('MONGODB_URI is not set. API will run without database persistence.');
    return null;
  }

  try {
    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DB_NAME || undefined,
    });
    dbStatus = 'connected';
    console.log('MongoDB connected');
    return mongoose.connection;
  } catch (error) {
    dbStatus = 'error';
    console.error('MongoDB connection failed:', error.message);
    return null;
  }
};

export const getDbStatus = () => dbStatus;

export const isMongoConnected = () => mongoose.connection.readyState === 1;
