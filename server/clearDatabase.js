require('dotenv').config();
const mongoose = require('mongoose');

async function clearDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Get all collections
        const collections = await mongoose.connection.db.collections();

        console.log('\n🗑️  Clearing all collections...\n');

        // Drop each collection
        for (let collection of collections) {
            const name = collection.collectionName;
            await collection.deleteMany({});
            console.log(`✅ Cleared collection: ${name}`);
        }

        console.log('\n✅ Database cleared successfully!\n');

        // Close connection
        await mongoose.connection.close();
        console.log('Connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing database:', error);
        process.exit(1);
    }
}

clearDatabase();
