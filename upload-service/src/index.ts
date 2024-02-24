import cors from 'cors';
import express, { Request, Response } from 'express';
import path from 'path';
import { createClient } from 'redis';
import simpleGit from 'simple-git';
import { generateId } from './generateRandomId';
import { getAllFiles, removeAllFiles } from './file';
import 'dotenv/config';
import { uploadFile } from './aws';

const redisPubSub = createClient();
redisPubSub.connect();

const app = express();

app.use(cors());
app.use(express.json());

app.post('/deploy', async (req: Request, res: Response) => {
  try {
    const repoUrl: string = req.body.repoUrl;

    if (!repoUrl) {
      return res
        .status(400)
        .json({ success: false, msg: 'Repo url is required' });
    }

    const id = generateId();
    const outputDir = path.join(__dirname, `../clonedRepos/${id}`);

    await simpleGit().clone(repoUrl, outputDir);

    const files = await getAllFiles(outputDir);
    for await (let file of files) {
      await uploadFile(file.split('vercel/')[1], file);
    }

    redisPubSub.lPush('build-queue', id);
    redisPubSub.hSet('status', id, 'uploaded');

    await removeAllFiles(outputDir);

    res.json({ success: true, id });
  } catch (error) {
    console.error('Error during uploading:', error);
    res.status(500).json({ success: false, msg: 'Internal server error' });
  }
});

app.get('/status', async (req, res) => {
  try {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({ success: false, msg: 'ID is required' });
    }

    const response = await redisPubSub.hGet('status', id as string);
    res.json({
      status: response,
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ success: false, msg: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
