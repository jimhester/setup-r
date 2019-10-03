import * as core from "@actions/core";
import { getR } from "./installer";

async function run() {
  try {
    core.debug(`started action`);
    let version = core.getInput("r-version");
    core.debug(`got version ${version}`);
    await getR(version);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
