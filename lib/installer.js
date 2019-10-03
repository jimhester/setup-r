"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
let tempDirectory = process.env["RUNNER_TEMP"] || "";
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const tc = __importStar(require("@actions/tool-cache"));
const io = __importStar(require("@actions/io"));
const util = __importStar(require("util"));
const path = __importStar(require("path"));
const fs_1 = require("fs");
const IS_WINDOWS = process.platform === "win32";
if (!tempDirectory) {
    let baseLocation;
    if (IS_WINDOWS) {
        // On windows use the USERPROFILE env variable
        baseLocation = process.env["USERPROFILE"] || "C:\\";
    }
    else {
        if (process.platform === "darwin") {
            baseLocation = "/Users";
        }
        else {
            baseLocation = "/home";
        }
    }
    tempDirectory = path.join(baseLocation, "actions", "temp");
}
function getR(version) {
    return __awaiter(this, void 0, void 0, function* () {
        let toolPath = tc.find("R", version);
        if (toolPath) {
            core.debug(`Tool found in cache ${toolPath}`);
        }
        else {
            // download, extract, cache
            toolPath = yield acquireR(version);
            core.debug("R is cached under " + toolPath);
        }
        setupRLibrary();
        core.addPath(toolPath);
    });
}
exports.getR = getR;
function acquireR(version) {
    return __awaiter(this, void 0, void 0, function* () {
        //
        // Download - a tool installer intimately knows how to get the tool (and construct urls)
        //
        let fileName = getFileName(version);
        let downloadUrl = getDownloadUrl(fileName);
        let downloadPath = null;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl);
            io.mv(downloadPath, "/tmp/R-latest.pkg");
        }
        catch (error) {
            core.debug(error);
            throw `Failed to download version ${version}: ${error}`;
        }
        //
        // Extract
        //
        let extPath = tempDirectory;
        if (!extPath) {
            throw new Error("Temp directory not set");
        }
        try {
            yield exec.exec("sudo", [
                "installer",
                "-pkg",
                "/tmp/R-latest.pkg",
                "-target",
                "/"
            ]);
        }
        catch (error) {
            core.debug(error);
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
        return "/";
    });
}
function setupRLibrary() {
    return __awaiter(this, void 0, void 0, function* () {
        let profilePath = path.join(process.env["HOME"] || "/Users", ".Rprofile");
        core.debug("R profile is at " + profilePath);
        yield fs_1.promises.writeFile(profilePath, 'options(repos = "https://cloud.r-project.org")');
    });
}
function getFileName(version) {
    const filename = util.format("R-%s", version);
    return filename;
}
function getDownloadUrl(filename) {
    const extension = "pkg";
    return util.format("https://cloud.r-project.org/bin/macosx/%s.%s", filename, extension);
}
