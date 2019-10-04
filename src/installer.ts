let tempDirectory = process.env["RUNNER_TEMP"] || "";

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import * as io from "@actions/io";
import * as util from "util";
import * as path from "path";
import { promises as fs } from "fs";
import * as restm from "typed-rest-client/RestClient";
import * as semver from "semver";

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
  const selected = await determineVersion(version);
  if (selected) {
    version = selected;
  }

  let toolPath = tc.find("R", version);

  if (toolPath) {
    core.debug(`Tool found in cache ${toolPath}`);
  } else {
    await acquireR(version);
  }

  setREnvironmentVariables();
  setupRLibrary();
}

async function acquireR(version: string) {
  if (IS_WINDOWS) {
    await acquireRWindows(version);
    acquireRtools();
  } else if (IS_MAC) {
    acquireRMacOS(version);
  } else {
    let returnCode = 1;
    try {
      returnCode = await exec.exec("R", ["--version"], {
        ignoreReturnCode: true,
        silent: true
      });
    } catch (e) {}

    core.debug(`returnCode: ${returnCode}`);
    if (returnCode != 0) {
      // We only want to acquire R here if it
      // doesn't already exist (because you are running in a container that
      // already includes it)
      acquireRUbuntu(version);
    }
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
    await exec.exec("sudo apt-get", ["install", "-y", "gdebi-core"]);
    await exec.exec("sudo gdebi", [
      "--non-interactive",
      path.join("/tmp", fileName)
    ]);
  } catch (error) {
    core.debug(error);

    throw `Failed to install R: ${error}`;
  }

  //
  // Add symlinks to the installed R to the path
  //
  //
  try {
    await exec.exec("sudo ln", [
      "-s",
      path.join("/opt", "R", version, "bin", "R"),
      "/usr/local/bin/R"
    ]);
    await exec.exec("sudo ln", [
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
    await exec.exec("choco", [
      "install",
      "r.project",
      "-y",
      "--no-progress",
      "--version",
      version
    ]);
  } catch (error) {
    core.debug(error);

    throw `Failed to install R: ${error}`;
  }

  core.addPath(`C:\\Program Files\\R\\R-${version}\\bin`);

  return "";
}

async function acquireRtools() {
  let fileName = "rtools.3.5.0.nupkg";
  try {
    let downloadPath = await tc.downloadTool(
      util.format(
        "https://github.com/hannesmuehleisen/choco-rtools/raw/master/%s",
        fileName
      )
    );
    io.mv(downloadPath, path.join(tempDirectory, fileName));
  } catch (error) {
    core.debug(error);

    throw `Failed to download Rtools script ${fileName}: ${error}`;
  }

  try {
    await exec.exec("choco", [
      "install",
      "rtools",
      "-y",
      "--no-progress",
      "-s",
      tempDirectory
    ]);
  } catch (error) {
    core.debug(error);

    throw `Failed to install Rtools: ${error}`;
  }

  core.addPath(`C:\\Rtools\\bin`);
  core.addPath(`C:\\Rtools\\mingw_64\\bin`);
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
    `options(repos = '${process.env["CRAN"] ||
      "https://cloud.r-project.org"}')\n`
  );

  // Make R_LIBS_USER
  io.mkdirP(process.env["R_LIBS_USER"] || path.join(tempDirectory, "Library"));
}

function getFileNameMacOS(version: string): string {
  const filename: string = util.format("R-%s.pkg", version);
  return filename;
}

function getDownloadUrlMacOS(version: string): string {
  const filename: string = util.format("R-%s.pkg", version);

  if (semver.lt(version, "3.4")) {
    // older versions are in old
    return util.format(
      "https://cloud.r-project.org/bin/macosx/old/%s",
      filename
    );
  }

  return util.format("https://cloud.r-project.org/bin/macosx/%s", filename);
}

function getFileNameUbuntu(version: string): string {
  const filename: string = util.format("r-%s_1_amd64.deb", version);
  return filename;
}

function getDownloadUrlUbuntu(filename: string): string {
  return util.format("https://cdn.rstudio.com/r/ubuntu-1804/pkgs/%s", filename);
}

function setREnvironmentVariables() {
  core.exportVariable("R_LIBS_USER", path.join(tempDirectory, "Library"));
}

async function determineVersion(version: string): Promise<string> {
  if (!version.endsWith(".x")) {
    const versionPart = version.split(".");

    if (versionPart[1] == null || versionPart[2] == null) {
      return await getLatestVersion(version.concat(".x"));
    } else {
      return version;
    }
  }

  return await getLatestVersion(version);
}

// This function is required to convert the version 1.10 to 1.10.0.
// Because caching utility accept only sementic version,
// which have patch number as well.
function normalizeVersion(version: string): string {
  const versionPart = version.split(".");
  if (versionPart[1] == null) {
    //append minor and patch version if not available
    return version.concat(".0.0");
  }

  if (versionPart[2] == null) {
    //append patch version if not available
    return version.concat(".0");
  }

  return version;
}

interface IRRef {
  version: string;
}

async function getAvailableVersions(): Promise<string[]> {
  let rest: restm.RestClient = new restm.RestClient("setup-r");
  let tags: IRRef[] =
    (await rest.get<IRRef[]>("https://rversions.r-pkg.org/r-versions"))
      .result || [];

  return tags.map(tag => tag.version);
}

async function getPossibleVersions(version: string): Promise<string[]> {
  const versions = await getAvailableVersions();
  const possibleVersions = versions.filter(v => v.startsWith(version));

  const versionMap = new Map();
  possibleVersions.forEach(v => versionMap.set(normalizeVersion(v), v));

  return Array.from(versionMap.keys())
    .sort(semver.rcompare)
    .map(v => versionMap.get(v));
}

async function getLatestVersion(version: string): Promise<string> {
  // clean .x syntax: 1.10.x -> 1.10
  const trimmedVersion = version.slice(0, version.length - 2);

  const versions = await getPossibleVersions(trimmedVersion);

  core.debug(`evaluating ${versions.length} versions`);

  if (version.length === 0) {
    throw new Error("unable to get latest version");
  }

  core.debug(`matched: ${versions[0]}`);

  return versions[0];
}
