import cors from "cors";
import express, { Request, Response } from "express";
import simpleGit from "simple-git";
import { generateId } from "./utils/generateRandomId";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/deploy", async (req: Request, res: Response) => {
  const repoUrl: string = req.body.repoUrl;

  if (!repoUrl) {
    return res
      .status(400)
      .json({ success: false, msg: "Repo url is required" });
  }

  const id = generateId();
  await simpleGit().clone(repoUrl, `output/${id}`);

  console.log(repoUrl);
  res.json({ success: true, id });
});

app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
