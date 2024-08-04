import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const userCollection = dbClient.db.collection('users');
    const user = await userCollection.findOne({ email });

    if (user) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
    const newUser = {
      email,
      password: hashedPassword,
    };

    const result = await userCollection.insertOne(newUser);
    return res.status(201).json({ id: result.insertedId, email });
  }
}

export default UsersController;
