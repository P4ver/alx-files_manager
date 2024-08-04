import crypto from 'crypto';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';  // Assuming you have this file set up for Redis

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      const userCollection = dbClient.db.collection('users');
      const user = await userCollection.findOne({ email });

      if (user) {
        return res.status(400).json({ error: 'Already exists' });
      }

      const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
      const newUser = {
        email,
        password: hashedPassword,
      };

      const result = await userCollection.insertOne(newUser);
      return res.status(201).json({ id: result.insertedId.toString(), email });
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getMe(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const redisKey = `auth_${token}`;
      const userId = await redisClient.getAsync(redisKey); // Use async method

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await dbClient.getUserById(userId);

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      res.status(200).json({ id: user._id.toString(), email: user.email });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default UsersController;

// import crypto from 'crypto';
// import dbClient from '../utils/db';

// class UsersController {
//   static async postNew(req, res) {
//     const { email, password } = req.body;

//     if (!email) {
//       return res.status(400).json({ error: 'Missing email' });
//     }

//     if (!password) {
//       return res.status(400).json({ error: 'Missing password' });
//     }

//     const userCollection = dbClient.db.collection('users');
//     const user = await userCollection.findOne({ email });

//     if (user) {
//       return res.status(400).json({ error: 'Already exist' });
//     }

//     const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
//     const newUser = {
//       email,
//       password: hashedPassword,
//     };

//     const result = await userCollection.insertOne(newUser);
//     return res.status(201).json({ id: result.insertedId, email });
//   }
// }

// export default UsersController;