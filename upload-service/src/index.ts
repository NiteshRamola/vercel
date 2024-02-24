import cors from 'cors';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
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

  await await new Promise((resolve) => setTimeout(resolve, 5000));
  redisPubSub.lPush('build-queue', id);

  redisPubSub.hSet('status', id, 'uploaded');

  await removeAllFiles(outputDir);

  res.json({ success: true, id });
});

app.get('/status', async (req, res) => {
  const id = req.query.id;
  const response = await redisPubSub.hGet('status', id as string);

  res.json({
    status: response,
  });
});

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
