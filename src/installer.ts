let tempDirectory = process.env['RUNNER_TEMP'] || '';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as util from 'util';
import * as path from 'path';
import {promises as fs} from 'fs';

const IS_WINDOWS = process.platform === 'win32';

if (!tempDirectory) {
  let baseLocation;
  if (IS_WINDOWS) {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env['USERPROFILE'] || 'C:\\';
  } else {
    if (process.platform === 'darwin') {
      baseLocation = '/Users';
    } else {
      baseLocation = '/home';
    }
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp');
}

export async function getR(version: string) {
  let toolPath = tc.find('R', version);

  if (toolPath) {
    core.debug(`Tool found in cache ${toolPath}`);
  } else {
    // download, extract, cache
    toolPath = await acquireR(version);
    core.debug('R is cached under ' + toolPath);
  }

  setupRLibrary();

  core.addPath(toolPath);
}

async function acquireR(version: string): Promise<string> {
  //
  // Download - a tool installer intimately knows how to get the tool (and construct urls)
  //
  let fileName: string = getFileName(version);
  let downloadUrl: string = getDownloadUrl(fileName);
  let downloadPath: string | null = null;
  try {
    downloadPath = await tc.downloadTool(downloadUrl);
  } catch (error) {
    core.debug(error);

    throw `Failed to download version ${version}: ${error}`;
  }

  //
  // Extract
  //
  let extPath: string = tempDirectory;
  if (!extPath) {
    throw new Error('Temp directory not set');
  }

  try {
  await exec.exec('installer', ['-pkg', downloadPath, '-target', '/'])
  } catch (error) {
    core.debug(error)

    throw `Failed to install R: ${error}`;
  }

  //if (osPlat == 'win32') {
    //extPath = await tc.extractZip(downloadPath);
  //} else {
    //extPath = await tc.extractTar(downloadPath);
  //}

  //
  // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
  //
  //const toolRoot = path.join(extPath, 'r');
  //version = normalizeVersion(version);
  //return await tc.cacheDir(toolRoot, 'r', version);
  return '/'
}

async function setupRLibrary() {
    await fs.writeFile('~/.Rprofile', 'options(repos = "https://cloud.r-project.org")')
}

function getFileName(version: string): string {
  const filename: string = util.format(
    'R-%s',
    version
  );
  return filename;
}

function getDownloadUrl(filename: string): string {
  return util.format('https://cloud.r-project.org/bin/macosx/%s', filename);
}
