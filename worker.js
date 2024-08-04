import Bull from 'bull';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import dbClient from './utils/db.js'; // Adjust path if needed

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

// Create a Bull queue for file processing
const fileQueue = new Bull('fileQueue', {
    redis: {
        host: 'localhost',
        port: 6379,
    },
});

fileQueue.process(async (job) => {
    const { userId, fileId } = job.data;

    if (!fileId) {
        throw new Error('Missing fileId');
    }
    if (!userId) {
        throw new Error('Missing userId');
    }

    const file = await dbClient.getFileById(fileId);
    if (!file || file.userId !== userId) {
        throw new Error('File not found');
    }

    if (file.type !== 'image') {
        throw new Error('File is not an image');
    }

    const filePath = file.localPath;
    if (!filePath || !fs.existsSync(filePath)) {
        throw new Error('File not found');
    }

    try {
        const sizes = [100, 250, 500];
        for (const size of sizes) {
            const thumbnailPath = path.join(FOLDER_PATH, `${fileId}_${size}`);
            const thumbnail = await imageThumbnail(filePath, { width: size });
            fs.writeFileSync(thumbnailPath, thumbnail);
        }
    } catch (error) {
        throw new Error('Thumbnail generation failed');
    }
});

fileQueue.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully.`);
});

fileQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error ${err.message}`);
});

console.log('Worker is running...');
