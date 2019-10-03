import * as core from '@actions/core';
import {getR} from './installer';

async function run() {
  try {
    let version = core.getInput('r-version');
    await getR(version);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
