import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env"
  );
}

// Global cache taake Next.js hot-reload par bar bar naya connection na banaye
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB() {
  // Agar pehle se connection bana hua hai aur active hai toh wahi wapas bhej do
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Agar connection dead ya disconnected ho chuka hai, cache reset karo
  if (mongoose.connection.readyState === 0) {
    cached.conn = null;
    cached.promise = null;
  }

  // Agar connection abhi ban raha hai toh naya promise banao
  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: true, // Queries wait safely for connection instead of failing
      serverSelectionTimeoutMS: 30000, // 30s buffer to prevent Atlas latency timeouts
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1, // Keep at least 1 warm socket alive
    };

    cached.promise = mongoose
      .connect(MONGODB_URI!, opts)
      .then((mongooseInstance) => {
        return mongooseInstance;
      })
      .catch((err) => {
        cached.promise = null;
        cached.conn = null;
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  }

  return cached.conn;
}
