const mongoose = require('mongoose');
let MongoMemoryServer;
try {
  MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
} catch (e) {
  MongoMemoryServer = null;
}

const connectDB = async (mongoUri) => {
  let uri = mongoUri;
  let memoryServer;
  try {
    if (!uri && MongoMemoryServer) {
      console.log('No MONGO_URI provided — starting in-memory MongoDB for dev.');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
    }

    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB connected: ${conn.connection.host || uri}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    if (!mongoUri && MongoMemoryServer) {
      try {
        console.log('Attempting to start in-memory MongoDB as a fallback...');
        memoryServer = await MongoMemoryServer.create();
        const fallbackUri = memoryServer.getUri();
        const conn2 = await mongoose.connect(fallbackUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        console.log(`MongoDB connected (in-memory): ${conn2.connection.host || fallbackUri}`);
        return;
      } catch (err2) {
        console.error('In-memory MongoDB connection failed:', err2.message);
      }
    }
    process.exit(1);
  }
};

module.exports = connectDB;
