// This script creates output that can be copy/pasted into /internal/node/node_repositories.bzl to
// add all published NodeJS versions >= 8.0.0.

const https = require("https");

const REPOSITORY_TYPES = {
  "darwin-x64.tar.gz": "darwin_amd64",
  "linux-x64.tar.xz": "linux_amd64",
  "linux-arm64.tar.xz": "linux_arm64",
  "win-x64.zip": "windows_amd64",
};

function getText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error());
      }
      const body = [];
      res.on("data", (chunk) => body.push(String(chunk)));
      res.on("end", () => resolve(body.join("")));
    });
  });
}

async function getJson(url) {
  return JSON.parse(await getText(url));
}

async function getNodeJsVersions() {
  const json = await getJson("https://nodejs.org/dist/index.json");

  return (
    json
      .map(({ version }) => version.slice(1).split(".").map(Number))
      // take only version >= 8.0.0
      .filter((version) => version[0] >= 8)
      .sort((lhs, rhs) => {
        if (lhs[0] === rhs[0]) {
          if (lhs[1] === rhs[1]) {
            return lhs[2] - rhs[2];
          } else {
            return lhs[1] - rhs[1];
          }
        }
        return lhs[0] - rhs[0];
      })
  );
}

async function getNodeJsVersion(version) {
  const text = await getText(
    `https://nodejs.org/dist/v${version.join(".")}/SHASUMS256.txt`
  );

  return {
    version,
    repositories: text
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, filename] = line.split(/\s+/);
        const type = REPOSITORY_TYPES[filename.replace(/^node-v[\d.]+-/, "")];
        return type ? { filename, sha, type } : undefined;
      })
      .filter(Boolean),
  };
}

async function main() {
  const versions = await getNodeJsVersions();
  const nodeRepositories = await Promise.all(versions.map(getNodeJsVersion));

  nodeRepositories.forEach(({ version, repositories }) => {
    console.log(
      [
        `# ${version.join(".")}`,
        ...repositories.map(
          ({ filename, sha, type }) =>
            `"${version.join(
              "."
            )}-${type}": ("${filename}", "${filename.replace(
              /(\.tar)?\.[^.]+$/,
              ""
            )}", "${sha}"),`
        ),
      ]
        .map((line) => `            ${line}`)
        .join("\n")
    );
  });
}

main();