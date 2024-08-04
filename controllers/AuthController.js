import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis.js'; // Make sure this path is correct
import dbClient from '../utils/db.js'; // Make sure this path is correct
import crypto from 'crypto';

const AuthController = {
    async getConnect(req, res) {
        try {
            const authHeader = req.headers['authorization'];
            if (!authHeader || !authHeader.startsWith('Basic ')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const base64Credentials = authHeader.split(' ')[1];
            const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
            const [email, password] = credentials.split(':');

            if (!email || !password) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
            console.log(`Email: ${email}, Hashed Password: ${hashedPassword}`);
            
            const user = await dbClient.getUserByEmailAndPassword(email, hashedPassword);

            if (!user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const token = uuidv4();
            const redisKey = `auth_${token}`;
            await redisClient.set(redisKey, user._id.toString(), 'EX', 86400); // 24 hours
            console.log("===========>",redisKey)
            res.status(200).json({ token });
        } catch (error) {
            console.error('Error in getConnect:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    async getDisconnect(req, res) {
        try {
            const token = req.headers['x-token'];
            if (!token) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const redisKey = `auth_${token}`;
            const userId = await redisClient.get(redisKey);

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            await redisClient.del(redisKey);
            res.status(204).send();
        } catch (error) {
            console.error('Error in getDisconnect:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

export default AuthController;
