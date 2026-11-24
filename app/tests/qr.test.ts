import assert from "node:assert/strict";
import { test } from "node:test";
import QRCode from "qrcode";
import { QUIET_ZONE, qrPath } from "@/lib/ui/qr";

/* Development step 5: the lobby's QR code, drawn on the server. */

const URL = "https://funza.example/join?code=K7QM4P";

test("the QR code is one path with a quiet zone, and the same link always draws the same code", () => {
  const a = qrPath(URL);
  const modules = QRCode.create(URL, { errorCorrectionLevel: "M" }).modules;
  assert.equal(a.size, modules.size + 2 * QUIET_ZONE);
  assert.deepEqual(qrPath(URL), a);
  assert.match(a.d, /^(M\d+ \d+h\d+v1h-\d+z)+$/);
  assert.notDeepEqual(qrPath(`${URL}X`), a, "another link, another code");
});

test("every dark module is inside the quiet zone, and every one is drawn", () => {
  const { size, d } = qrPath(URL);
  const modules = QRCode.create(URL, { errorCorrectionLevel: "M" }).modules;
  let dark = 0;
  for (let r = 0; r < modules.size; r++) for (let c = 0; c < modules.size; c++) dark += modules.get(r, c) ? 1 : 0;
  let drawn = 0;
  for (const [, x, y, run] of d.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
    assert.ok(Number(x) >= QUIET_ZONE && Number(y) >= QUIET_ZONE, "not in the quiet zone");
    assert.ok(Number(x) + Number(run) <= size - QUIET_ZONE && Number(y) < size - QUIET_ZONE);
    drawn += Number(run);
  }
  assert.equal(drawn, dark);
});
