require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");


const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/';

// Connect to MongoDB, then start server
connectDB(MONGO_URI).then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}); 
