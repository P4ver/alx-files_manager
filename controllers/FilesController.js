import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import dbClient from '../utils/db.js';
import redisClient from '../utils/redis.js';

const fileQueue = new Bull('fileQueue', {
    redis: {
        host: 'localhost',
        port: 6379,
    },
});

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

                if (type === 'image') {
                    await fileQueue.add({
                        userId,
                        fileId: newFile.id
                    });
                }

                return res.status(201).json(newFile);
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    async getShow(req, res) {
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

            const fileId = req.params.id;
            const file = await dbClient.getFileById(fileId);

            if (!file || file.userId !== userId) {
                return res.status(404).json({ error: 'Not found' });
            }

            return res.status(200).json(file);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    async getIndex(req, res) {
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

            const { parentId = 0, page = 0 } = req.query;
            const pageSize = 20;
            const skip = page * pageSize;

            const files = await dbClient.listFiles({ userId, parentId, skip, limit: pageSize });

            return res.status(200).json(files);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    async putPublish(req, res) {
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

            const fileId = req.params.id;
            const file = await dbClient.getFileById(fileId);

            if (!file || file.userId !== userId) {
                return res.status(404).json({ error: 'Not found' });
            }

            file.isPublic = true;
            const updatedFile = await dbClient.updateFile(fileId, file);

            return res.status(200).json(updatedFile);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    async putUnpublish(req, res) {
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

            const fileId = req.params.id;
            const file = await dbClient.getFileById(fileId);

            if (!file || file.userId !== userId) {
                return res.status(404).json({ error: 'Not found' });
            }

            file.isPublic = false;
            const updatedFile = await dbClient.updateFile(fileId, file);

            return res.status(200).json(updatedFile);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    async getFile(req, res) {
        try {
            const token = req.headers['x-token'];
            const fileId = req.params.id;

            const file = await dbClient.getFileById(fileId);

            if (!file) {
                return res.status(404).json({ error: 'Not found' });
            }

            // Check for public access or user authorization
            if (!file.isPublic) {
                if (!token) {
                    return res.status(404).json({ error: 'Not found' });
                }

                const redisKey = `auth_${token}`;
                const userId = await redisClient.get(redisKey);
                if (!userId || file.userId !== userId) {
                    return res.status(404).json({ error: 'Not found' });
                }
            }

            if (file.type === 'folder') {
                return res.status(400).json({ error: "A folder doesn't have content" });
            }

            if (!file.localPath || !fs.existsSync(file.localPath)) {
                return res.status(404).json({ error: 'Not found' });
            }

            const mimeType = mime.lookup(file.name) || 'application/octet-stream';
            const fileContent = fs.readFileSync(file.localPath);

            res.setHeader('Content-Type', mimeType);
            return res.status(200).send(fileContent);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    
};

export default FilesController;
