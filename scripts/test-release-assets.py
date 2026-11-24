import contextlib
import io
import pathlib
import runpy
import tempfile
import tarfile
import unittest
from unittest.mock import patch

helper = runpy.run_path(str(pathlib.Path(__file__).with_name("release-assets.py")))


class ServiceReleaseTests(unittest.TestCase):
    def test_service_stream_ignores_app_legacy_and_prerelease_tags(self):
        archive = "homehq-service-v1.2.0-amd64.tar.gz"
        releases = [
            dict(tag_name=tag, draft=False, prerelease=unstable,
                 assets=[{"name": name} for name in
                         (archive, "service-update-manifest.json", archive + ".attestation.jsonl")])
            for tag, unstable in [("app-v9.1.0", False), ("v9.1.0", False), ("service-v8.0.0", True),
                                  ("service-v1.1.9", False), ("service-v1.2.0", False)]
        ]
        manifest = dict(schemaVersion=1, version="1.2.0", artifact=archive, sha256="b" * 64, commit="a" * 40)
        output = io.StringIO()
        with patch.dict(helper["release"].__globals__, fetch_json=lambda url: manifest if url.endswith(".json") else releases):
            with contextlib.redirect_stdout(output):
                helper["release"]()
        self.assertEqual(output.getvalue().splitlines()[:2], ["1.2.0", archive])

    def test_unpack_rejects_escaping_paths_and_links(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            for name in ("../escape", "/escape", "link"):
                archive = root / "unsafe.tgz"
                with tarfile.open(archive, "w:gz") as writer:
                    member = tarfile.TarInfo(name)
                    if name == "link":
                        member.type = tarfile.SYMTYPE
                        member.linkname = "/escape"
                    writer.addfile(member)
                with self.assertRaisesRegex(ValueError, "Unsafe service archive"):
                    helper["unpack"](archive, root / "out")


if __name__ == "__main__":
    unittest.main()
