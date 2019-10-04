let tempDirectory = process.env["RUNNER_TEMP"] || "";

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import * as io from "@actions/io";
import * as util from "util";
import * as path from "path";
import { promises as fs } from "fs";

const IS_WINDOWS = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

if (!tempDirectory) {
  let baseLocation;
  if (IS_WINDOWS) {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env["USERPROFILE"] || "C:\\";
  } else {
    if (IS_MAC) {
      baseLocation = "/Users";
    } else {
      baseLocation = "/home";
    }
  }
  tempDirectory = path.join(baseLocation, "actions", "temp");
}

export async function getR(version: string) {
  let toolPath = tc.find("R", version);

  if (toolPath) {
    core.debug(`Tool found in cache ${toolPath}`);
  } else {
    // download, extract, cache
    toolPath = await acquireR(version);
    core.debug("R is cached under " + toolPath);
  }

  setupRLibrary();

  //core.addPath(toolPath);
}

async function acquireR(version: string): Promise<string> {
  if (IS_WINDOWS) {
    return acquireRWindows(version);
  } else if (IS_MAC) {
    return acquireRMacOS(version);
  } else {
    return acquireRUbuntu(version);
  }
}

async function acquireRUbuntu(version: string): Promise<string> {
  //
  // Download - a tool installer intimately knows how to get the tool (and construct urls)
  //
  let fileName: string = getFileNameUbuntu(version);
  let downloadUrl: string = getDownloadUrlUbuntu(fileName);
  let downloadPath: string | null = null;
  try {
    downloadPath = await tc.downloadTool(downloadUrl);
    io.mv(downloadPath, path.join("/tmp", fileName));
  } catch (error) {
    core.debug(error);

    throw `Failed to download version ${version}: ${error}`;
  }

  //
  // Install
  //
  let extPath: string = tempDirectory;
  if (!extPath) {
    throw new Error("Temp directory not set");
  }

  try {
    await exec.exec("sudo", ["apt-get", "install", "gdebi-core"]);
    await exec.exec("sudo", ["gdebi", path.join("/tmp", fileName)]);
  } catch (error) {
    core.debug(error);

    throw `Failed to install R: ${error}`;
  }

  //
  // Add symlinks to the installed R to the path
  //
  //
  try {
    await exec.exec("sudo", [
      "ln",
      "-s",
      path.join("/opt", "R", version, "bin", "R"),
      "/usr/local/bin/R"
    ]);
    await exec.exec("sudo", [
      "ln",
      "-s",
      path.join("/opt", "R", version, "bin", "Rscript"),
      "/usr/local/bin/Rscript"
    ]);
  } catch (error) {
    core.debug(error);

    throw `Failed to setup symlinks to R: ${error}`;
  }

  return "/usr/local/bin";
}

async function acquireRMacOS(version: string): Promise<string> {
  //
  // Download - a tool installer intimately knows how to get the tool (and construct urls)
  //
  let fileName: string = getFileNameMacOS(version);
  let downloadUrl: string = getDownloadUrlMacOS(fileName);
  let downloadPath: string | null = null;
  try {
    downloadPath = await tc.downloadTool(downloadUrl);
    io.mv(downloadPath, path.join("/tmp", fileName));
  } catch (error) {
    core.debug(error);

    throw `Failed to download version ${version}: ${error}`;
  }

  //
  // Extract
  //
  let extPath: string = tempDirectory;
  if (!extPath) {
    throw new Error("Temp directory not set");
  }

  try {
    await exec.exec("sudo", [
      "installer",
      "-pkg",
      path.join("/tmp", fileName),
      "-target",
      "/"
    ]);
  } catch (error) {
    core.debug(error);

    throw `Failed to install R: ${error}`;
  }

  return "/";
}

async function acquireRWindows(version: string): Promise<string> {
  try {
    await exec.exec("choco", ["install", "r-project"]);
  } catch (error) {
    core.debug(error);

    throw `Failed to install R: ${error}`;
  }

  return "";
}

async function setupRLibrary() {
  let profilePath;
  if (IS_WINDOWS) {
    profilePath = path.join(
      process.env["USERPROFILE"] || "C:\\",
      "Documents",
      ".Rprofile"
    );
  } else {
    profilePath = path.join(process.env["HOME"] || "/Users", ".Rprofile");
  }
  core.debug("R profile is at " + profilePath);
  await fs.writeFile(
    profilePath,
    'options(repos = "https://cloud.r-project.org")\n'
  );
}

function getFileNameMacOS(version: string): string {
  const filename: string = util.format("R-%s.pkg", version);
  return filename;
}

function getDownloadUrlMacOS(filename: string): string {
  return util.format("https://cloud.r-project.org/bin/macosx/%s", filename);
}

function getFileNameUbuntu(version: string): string {
  const filename: string = util.format("r-%s_1_amd64.deb", version);
  return filename;
}

function getDownloadUrlUbuntu(filename: string): string {
  return util.format("https://cdn.rstudio.com/r/ubuntu-1804/pkgs/%s", filename);
}
