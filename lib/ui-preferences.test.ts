import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_UI,
  parseUIPreferences,
  serializeUIPreferences,
} from "./ui-preferences.ts";

test("UI preferences validate saved data and roundtrip separately from fortress saves", () => {
  const settings = {
    ...DEFAULT_UI,
    fontSize: 28,
    mapZoom: "fit" as const,
    theme: "contrast" as const,
    labels: true,
    favorites: ["BUILD_STILL" as const],
  };
  assert.deepEqual(
    parseUIPreferences(serializeUIPreferences(settings)),
    settings,
  );
  assert.deepEqual(parseUIPreferences("{bad"), DEFAULT_UI);
  assert.deepEqual(
    parseUIPreferences('{"version":99,"preferences":{}}'),
    DEFAULT_UI,
  );
});
test("untrusted preference values cannot introduce invalid sizes or tool IDs", () => {
  const parsed = parseUIPreferences(
    JSON.stringify({
      version: 1,
      preferences: {
        fontSize: -100,
        mapZoom: 999999,
        labels: "false",
        reducedMotion: "true",
        favorites: ["MINE", "MINE", "<script>", null],
      },
    }),
  );
  assert.equal(parsed.fontSize, DEFAULT_UI.fontSize);
  assert.equal(parsed.mapZoom, DEFAULT_UI.mapZoom);
  assert.equal(parsed.labels, false);
  assert.equal(parsed.reducedMotion, false);
  assert.deepEqual(parsed.favorites, ["MINE"]);
});
