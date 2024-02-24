import fs from 'fs/promises';
import path from 'path';

export const getAllFiles = async (folderPath: string): Promise<string[]> => {
  let response: string[] = [];

  const allFilesAndFolders = await fs.readdir(folderPath);

  for await (let file of allFilesAndFolders) {
    if (file === '.git') {
      continue;
    }

    const fullFilePath = path.join(folderPath, file);

    const stat = await fs.stat(fullFilePath);
    if (stat.isDirectory()) {
      response = response.concat(await getAllFiles(fullFilePath));
    } else {
      response.push(fullFilePath);
    }
  }

  return response;
};

export const removeAllFiles = async (folderPath: string) => {
  const allFilesAndFolders = await fs.readdir(folderPath);

  for await (let file of allFilesAndFolders) {
    const fullFilePath = path.join(folderPath, file);

    const stat = await fs.stat(fullFilePath);
    if (stat.isDirectory()) {
      await removeAllFiles(fullFilePath);
    } else {
      await fs.unlink(fullFilePath);
    }
  }

  console.log('herere');

  await fs.rmdir(folderPath);
};
