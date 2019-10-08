import * as core from "@actions/core";
import { getR } from "./installer";
import * as path from "path";

async function run() {
  try {
    core.debug(`started action`);
    let version = core.getInput("r-version");
    core.debug(`got version ${version}`);
    let rtoolsVersion = core.getInput("rtools-version");
    core.debug(`got rtools-version ${rtoolsVersion}`);
    await getR(version, rtoolsVersion);

    const matchersPath = path.join(__dirname, "..", ".github");
    console.log(`##[add-matcher]${path.join(matchersPath, "r.json")}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
