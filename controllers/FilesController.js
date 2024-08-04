import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import dbClient from '../utils/db.js';
import redisClient from '../utils/redis.js';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

const FilesController = {
    async postUpload(req, res) {
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

            const { name, type, parentId = 0, isPublic = false, data } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Missing name' });
            }

            if (!['folder', 'file', 'image'].includes(type)) {
                return res.status(400).json({ error: 'Missing type' });
            }

            if (type !== 'folder' && !data) {
                return res.status(400).json({ error: 'Missing data' });
            }

            if (parentId) {
                const parentFile = await dbClient.getFileById(parentId);
                if (!parentFile) {
                    return res.status(400).json({ error: 'Parent not found' });
                }
                if (parentFile.type !== 'folder') {
                    return res.status(400).json({ error: 'Parent is not a folder' });
                }
            }

            let fileDocument = {
                userId,
                name,
                type,
                isPublic,
                parentId,
                localPath: null
            };

            if (type === 'folder') {
                const newFile = await dbClient.createFile(fileDocument);
                return res.status(201).json(newFile);
            } else {
                const filePath = path.join(FOLDER_PATH, uuidv4());
                const buffer = Buffer.from(data, 'base64');

                fs.writeFileSync(filePath, buffer);
                fileDocument.localPath = filePath;

                const newFile = await dbClient.createFile(fileDocument);
                return res.status(201).json(newFile);
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

export default FilesController;
