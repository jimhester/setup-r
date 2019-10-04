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
const IS_MAC = process.platform === "darwin";
if (!tempDirectory) {
    let baseLocation;
    if (IS_WINDOWS) {
        // On windows use the USERPROFILE env variable
        baseLocation = process.env["USERPROFILE"] || "C:\\";
    }
    else {
        if (IS_MAC) {
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
        if (IS_WINDOWS) {
            return "";
        }
        else if (IS_MAC) {
            return acquireRMacOS(version);
        }
        else {
            return acquireRUbuntu(version);
        }
    });
}
function acquireRUbuntu(version) {
    return __awaiter(this, void 0, void 0, function* () {
        //
        // Download - a tool installer intimately knows how to get the tool (and construct urls)
        //
        let fileName = getFileNameUbuntu(version);
        let downloadUrl = getDownloadUrlUbuntu(fileName);
        let downloadPath = null;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl);
            io.mv(downloadPath, path.join("/tmp", fileName));
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
            yield exec.exec("sudo", ["apt-get", "install", "gdebi-core"]);
            yield exec.exec("sudo", ["gdebi", path.join("/tmp", fileName)]);
        }
        catch (error) {
            core.debug(error);
            throw `Failed to install R: ${error}`;
        }
        //
        // Add symlinks to the installed R to the path
        //
        //
        try {
            yield exec.exec("sudo", [
                "ln",
                "-s",
                path.join("/opt", "R", version, "bin", "R"),
                "/usr/local/bin/R"
            ]);
            yield exec.exec("sudo", [
                "ln",
                "-s",
                path.join("/opt", "R", version, "bin", "Rscript"),
                "/usr/local/bin/Rscript"
            ]);
        }
        catch (error) {
            core.debug(error);
            throw `Failed to setup symlinks to R: ${error}`;
        }
        return "/usr/local/bin";
    });
}
function acquireRMacOS(version) {
    return __awaiter(this, void 0, void 0, function* () {
        //
        // Download - a tool installer intimately knows how to get the tool (and construct urls)
        //
        let fileName = getFileNameMacOS(version);
        let downloadUrl = getDownloadUrlMacOS(fileName);
        let downloadPath = null;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl);
            io.mv(downloadPath, path.join("/tmp", fileName));
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
                path.join("/tmp", fileName),
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
        yield fs_1.promises.writeFile(profilePath, 'options(repos = "https://cloud.r-project.org")\n');
    });
}
function getFileNameMacOS(version) {
    const filename = util.format("R-%s.pkg", version);
    return filename;
}
function getDownloadUrlMacOS(filename) {
    return util.format("https://cloud.r-project.org/bin/macosx/%s", filename);
}
function getFileNameUbuntu(version) {
    const filename = util.format("r-%s_1_amd64.deb", version);
    return filename;
}
function getDownloadUrlUbuntu(filename) {
    return util.format("https://cdn.rstudio.com/r/ubuntu-1804/pkgs/%s", filename);
}
