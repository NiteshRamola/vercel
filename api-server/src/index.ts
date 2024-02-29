import { ECSClient, LaunchType, RunTaskCommand } from '@aws-sdk/client-ecs';
import { DeploymentStatus, PrismaClient } from '@prisma/client';
import cors from 'cors';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'http';
import Redis from 'ioredis';
import morgan from 'morgan';
import { generateSlug } from 'random-word-slugs';
import { Server } from 'socket.io';
import { z } from 'zod';

// Constants
const DEPLOYMENT_STATUS = {
  START: 'Deployment started',
  END: 'Deployment completed',
  ERROR: 'Error',
};

// Initialize express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Initialize HTTP server and Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Initialize Redis subscriber
const subscriber = new Redis(process.env.REDIS_URI!);

// Initialize ECS client
const ecsClient = new ECSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Initialize Prisma client
const prisma = new PrismaClient({});

// Validation schemas
const projectSchema = z.object({
  name: z.string(),
  gitURL: z.string(),
});

const deploySchema = z.object({
  projectId: z.string(),
});

// Routes
app.post('/project', async (req: Request, res: Response) => {
  try {
    const safeParseResult = await projectSchema.safeParseAsync(req.body);

    if (!safeParseResult.success)
      return res
        .status(400)
        .json({ success: false, msg: safeParseResult.error });

    const { name, gitURL } = safeParseResult.data;

    const project = await prisma.project.create({
      data: {
        name,
        gitURL,
        subDomain: generateSlug(),
      },
    });

    return res.json({ success: true, data: project });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, msg: 'Internal server error' });
  }
});

app.post('/deploy', async (req: Request, res: Response) => {
  try {
    const safeParseResult = await deploySchema.safeParseAsync(req.body);

    if (!safeParseResult.success)
      return res
        .status(400)
        .json({ success: false, msg: safeParseResult.error });

    const { projectId } = safeParseResult.data;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(400).json({ success: false, msg: 'Project not found' });
    }

    const runningDeployment = await prisma.deployment.count({
      where: {
        projectId: projectId,
        status: { in: ['IN_PROGRESS', 'QUEUED'] },
      },
    });

    if (runningDeployment) {
      return res
        .status(400)
        .json({ success: false, msg: 'Deployment already running' });
    }

    const deployment = await prisma.deployment.create({
      data: {
        project: { connect: { id: projectId } },
      },
    });

    const command = new RunTaskCommand({
      cluster: process.env.CLUSTER,
      taskDefinition: process.env.TASK,
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
              { name: 'GIT_REPOSITORY__URL', value: project.gitURL },
              { name: 'PROJECT_ID', value: projectId },
              { name: 'DEPLOYMENT_ID', value: deployment.id },
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
              { name: 'REDIS_URI', value: process.env.REDIS_URI },
              { name: 'DEPLOYMENT_START', value: DEPLOYMENT_STATUS.START },
              { name: 'DEPLOYMENT_END', value: DEPLOYMENT_STATUS.END },
              { name: 'DEPLOYMENT_ERROR', value: DEPLOYMENT_STATUS.ERROR },
            ],
          },
        ],
      },
    });

    await ecsClient.send(command);

    return res.json({
      status: 'queued',
      data: { url: `http://${project.subDomain}.niteshramola.in`, deployment },
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, msg: 'Internal server error' });
  }
});

app.get('/project/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const project = await prisma.project.findFirst({
      where: {
        id: id,
      },
    });

    return res.json({ success: true, data: project });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, msg: 'Internal server error' });
  }
});

app.get('/deployment/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const deployment = await prisma.deployment.findFirst({
      where: {
        id: id,
      },
    });

    return res.json({ success: true, data: deployment });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, msg: 'Internal server error' });
  }
});

app.get('/logs/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const logs = await prisma.log_events.findMany({
      where: {
        deployment_id: id,
      },
      skip: skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ success: true, data: logs });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, msg: 'Internal server error' });
  }
});

// Socket.IO connection
io.on('connection', (socket) => {
  socket.on('subscribe', (channel) => {
    socket.join(channel);
    console.log('channel joined', channel);
  });
});

// Log types
interface LogType {
  log: string;
  deployment_id: string;
  project_id: string;
}

// Redis subscription initialization
subscriber.subscribe('logs');

subscriber.on('message', async (channel, message) => {
  try {
    const parsedMessage: LogType = JSON.parse(message);
    console.log('Message from Redis received', message, channel);

    io.to(parsedMessage.deployment_id).emit('message', parsedMessage.log);

    await prisma.log_events.create({
      data: {
        deployment: { connect: { id: parsedMessage.deployment_id } },
        log: parsedMessage.log,
      },
    });

    let status: DeploymentStatus | undefined;
    if (parsedMessage.log === DEPLOYMENT_STATUS.START) {
      status = DeploymentStatus.IN_PROGRESS;
    } else if (parsedMessage.log === DEPLOYMENT_STATUS.END) {
      status = DeploymentStatus.COMPLETED;
    } else if (parsedMessage.log.includes(DEPLOYMENT_STATUS.ERROR)) {
      status = DeploymentStatus.FAIL;
    }

    if (status) {
      await prisma.deployment.update({
        where: { id: parsedMessage.deployment_id },
        data: {
          status: status,
        },
      });

      io.to(parsedMessage.deployment_id).emit('deploymentStatus', status);
    }
  } catch (error) {
    console.error('Error processing Redis message:', error);
  }
});

// Server start
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on Port: ${PORT}`);
});
