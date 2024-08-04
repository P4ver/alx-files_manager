const { MongoClient } = require('mongodb');

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';
const url = `mongodb://${host}:${port}`;

class DBClient {
  constructor() {
    MongoClient.connect(url, (err, client) => {
      if (!err) {
        this.db = client.db(database);
      } else {
        this.db = false;
      }
    });
  }

  isAlive() {
    if (this.db) return true;
    return false;
  }

  async nbUsers() {
    console.log(this.db)
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }

    async getUserByEmailAndPassword(email, password) {
      console.log("===>",this.db)

        const db = this.client.db(this.database);
        return db.collection('users').findOne({ email, password });
    }

    async getUserById(userId) {
        const db = this.client.db(this.database);
        return db.collection('users').findOne({ _id: new MongoClient.ObjectId(userId) });
    }  

    async getFileById(fileId) {
      const db = this.client.db(this.database);
      return db.collection('files').findOne({ _id: new ObjectId(fileId) });
  }

  async createFile(fileDocument) {
      const db = this.client.db(this.database);
      const result = await db.collection('files').insertOne(fileDocument);
      return result.ops[0];
  }
}

const dbClient = new DBClient();
export default dbClient;
