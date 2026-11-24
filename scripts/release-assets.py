"""Resolve and unpack Home HQ service releases for the root-owned installer."""
import json
import re
import shutil
import sys
import tarfile
import urllib.request
from pathlib import Path, PurePosixPath

REPO = "donselkirk/calendar"
API = f"https://api.github.com/repos/{REPO}"
VERSION = r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)"


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        return json.loads(response.read(4 * 1024 * 1024))


def release():
    candidates = []
    page = 1
    while True:
        batch = fetch_json(f"{API}/releases?per_page=100&page={page}")
        for item in batch:
            match = re.fullmatch(f"service-v({VERSION})", item["tag_name"])
            if match and not item["draft"] and not item["prerelease"]:
                candidates.append((tuple(map(int, match[1].split("."))), item))
        if len(batch) < 100:
            break
        page += 1
    if not candidates:
        raise ValueError("No stable service release found")
    _, latest = max(candidates, key=lambda pair: pair[0])
    version = latest["tag_name"].removeprefix("service-v")
    names = {a["name"] for a in latest["assets"]}
    archive = f"homehq-service-v{version}-amd64.tar.gz"
    if not {archive, "service-update-manifest.json", archive + ".attestation.jsonl"} <= names:
        raise ValueError("Service release is missing required artifacts")
    base = f"https://github.com/{REPO}/releases/download/service-v{version}"
    manifest = fetch_json(base + "/service-update-manifest.json")
    if (manifest.get("schemaVersion"), manifest.get("version"), manifest.get("artifact")) != (1, version, archive):
        raise ValueError("Invalid service manifest")
    if not re.fullmatch(r"[a-f0-9]{64}", manifest.get("sha256", "")) or not re.fullmatch(
        r"[a-f0-9]{40}", manifest.get("commit", "")
    ):
        raise ValueError("Invalid service digest")
    print(version, archive, manifest["sha256"], manifest["commit"], base, sep="\n")


def notes(metadata):
    version = Path(metadata).read_text().splitlines()[0]
    if not re.fullmatch(VERSION, version):
        raise ValueError("Invalid release version")
    release = fetch_json(f"{API}/releases/tags/service-v{version}")
    print(re.sub(r"[\x00-\x08\x0b-\x1f\x7f-\x9f]", "", (release.get("body") or "")[:12000]))


def unpack(archive, output):
    root = Path(output).resolve()
    total = 0
    with tarfile.open(archive, "r:gz") as tar:
        for member in tar:
            name = PurePosixPath(member.name)
            if name.is_absolute() or ".." in name.parts or not (member.isdir() or member.isfile()):
                raise ValueError("Unsafe service archive")
            total += member.size
            if total > 512 * 1024 * 1024:
                raise ValueError("Service archive is too large")
            path = root.joinpath(*name.parts)
            if member.isdir():
                path.mkdir(parents=True, exist_ok=True)
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                with tar.extractfile(member) as source, path.open("xb") as dest:
                    shutil.copyfileobj(source, dest)
                path.chmod(0o755 if name.as_posix() == "node" else 0o644)


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["metadata"]:
            release()
        elif len(sys.argv) == 3 and sys.argv[1] == "notes":
            notes(sys.argv[2])
        elif len(sys.argv) == 4 and sys.argv[1] == "unpack":
            unpack(*sys.argv[2:])
        else:
            sys.exit("Invalid release helper arguments")
    except (ValueError, OSError, KeyError, TypeError, tarfile.TarError) as error:
        sys.exit(f"Release check failed: {error}")
