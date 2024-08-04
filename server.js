import express from 'express';
import router from './routes/index';
import fs from 'fs';
import path from 'path';

const app = express();
const port = process.env.PORT || 5000;

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

if (!fs.existsSync(FOLDER_PATH)) {
    fs.mkdirSync(FOLDER_PATH, { recursive: true });
}


app.use(express.json());
app.use('/', router);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 