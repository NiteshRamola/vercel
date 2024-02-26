import cors from 'cors';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { createClient } from 'redis';
import simpleGit from 'simple-git';
import { uploadFile } from './aws';
import { getAllFiles, removeAllFiles } from './file';
import { generateId } from './generateRandomId';

const redisClient = createClient();
redisClient.connect();

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
    const output = 'clonedRepos';
    const outputDir = path.join(__dirname, `../../${output}/${id}`);

    await simpleGit().clone(repoUrl, outputDir);

    const files = await getAllFiles(outputDir);
    for await (let file of files) {
      await uploadFile(output + file.split(output)[1], file);
    }

    redisClient.lPush('build-queue', id);
    redisClient.hSet('status', id, 'uploaded');

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

    const response = await redisClient.hGet('status', id as string);
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
