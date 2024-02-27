import { ECSClient, LaunchType, RunTaskCommand } from '@aws-sdk/client-ecs';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import { generateSlug } from 'random-word-slugs';

const app = express();

app.use(express.json());

const ecsClient = new ECSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const config = {
  CLUSTER: process.env.CLUSTER,
  TASK: process.env.TASK,
};

app.post('/deploy', async (req: Request, res: Response) => {
  try {
    const { repoUrl } = req.body;

    if (!repoUrl) {
      return res.status(400).send('Repository URL is required.');
    }

    const projectSlug = generateSlug();

    const command = new RunTaskCommand({
      cluster: config.CLUSTER,
      taskDefinition: config.TASK,
      launchType: LaunchType.FARGATE,
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: 'ENABLED',
          subnets: [
            process.env.AWS_SUBNET_1!,
            process.env.AWS_SUBNET_2!,
            process.env.AWS_SUBNET_3!,
          ],
          securityGroups: [process.env.AWS_SECURITY_GROUP!],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'builder-image-vercel',
            environment: [
              { name: 'GIT_REPOSITORY__URL', value: repoUrl },
              { name: 'PROJECT_ID', value: projectSlug },
              {
                name: 'AWS_ACCESS_KEY_ID',
                value: process.env.AWS_ACCESS_KEY_ID,
              },
              {
                name: 'AWS_SECRET_ACCESS_KEY',
                value: process.env.AWS_SECRET_ACCESS_KEY,
              },
              { name: 'AWS_REGION', value: process.env.AWS_REGION },
              { name: 'BUCKET_NAME', value: process.env.BUCKET_NAME },
            ],
          },
        ],
      },
    });

    await ecsClient.send(command);

    return res.json({
      status: 'queued',
      data: { projectSlug, url: `http://${projectSlug}.nitesh.com` },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send('Internal server error');
  }
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server running on Port: ${PORT}`);
});
