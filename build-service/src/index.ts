import { createClient, commandOptions } from 'redis';
import { copyFinalDist, downloadS3Folder } from './aws';
import { buildProject } from './build';

const redisClient = createClient();
redisClient.connect();

async function main() {
  while (1) {
    const res = await redisClient.brPop(
      commandOptions({ isolated: true }),
      'build-queue',
      0,
    );

    if (!res) {
      continue;
    }

    console.log('Item received in the queue:', res);

    const id = res.element;

    await downloadS3Folder(`clonedRepos/${id}`);

    await buildProject(id);
    copyFinalDist(id);

    redisClient.hSet('status', id, 'deployed');
  }
}
main();
