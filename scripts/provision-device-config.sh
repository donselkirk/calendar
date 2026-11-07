#!/usr/bin/env bash
set -euo pipefail

config="${1:-device-config.json}"
package="com.wesbos.homehq"
remote="/data/data/$package/files/device-config.json"

if [ ! -f "$config" ]; then
  echo "Configuration file not found: $config" >&2
  exit 1
fi

python3 - "$config" <<'PY'
import json, re, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
assert data.get("schemaVersion") == 1, "schemaVersion must be 1"
assert isinstance(data.get("familyLabel"), str) and data["familyLabel"].strip()
people = data.get("people")
assert isinstance(people, list) and people, "at least one person is required"
ids = set()
for person in people:
    assert re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", person.get("id", "")), "invalid person id"
    assert person["id"] not in ids, "duplicate person id"
    ids.add(person["id"])
    assert isinstance(person.get("name"), str) and person["name"].strip()
    assert re.fullmatch(r"#[0-9A-Fa-f]{6}", person.get("color", "")), "invalid color"
    assert re.fullmatch(r"#[0-9A-Fa-f]{6}", person.get("ink", "")), "invalid ink"
waste = data.get("waste", {})
assert isinstance(waste.get("placeId"), str) and waste["placeId"].strip()
assert isinstance(waste.get("serviceId"), int) and waste["serviceId"] > 0
PY

temp="/data/local/tmp/homehq-device-config.json"
adb push "$config" "$temp"
adb shell su -c "mkdir -p /data/data/$package/files && cp $temp $remote && chown $(adb shell dumpsys package "$package" | sed -n 's/.*userId=\([0-9]*\).*/\1/p' | head -n1):$(adb shell dumpsys package "$package" | sed -n 's/.*userId=\([0-9]*\).*/\1/p' | head -n1) $remote && chmod 600 $remote && rm $temp"
echo "Provisioned $remote"
