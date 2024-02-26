import path from 'path';
import { commandOptions, createClient } from 'redis';
import { copyFinalDist, downloadS3Folder } from './aws';
import { buildProject } from './build';
import { removeAllFiles } from './file';

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
    const folderPath = path.resolve(__dirname, `../../clonedRepos/${id}/dist`);

    await downloadS3Folder(`clonedRepos/${id}`);

    await buildProject(id);
    console.log('build completed...');

    await copyFinalDist(id, folderPath);
    console.log('copy to s3 completed...');

    redisClient.hSet('status', id, 'deployed');
    await removeAllFiles(path.join(__dirname, `../../clonedRepos/${id}`));
  }
}
main();
