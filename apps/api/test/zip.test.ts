import assert from "node:assert/strict";
import test from "node:test";
import { crc32, zipStore } from "../src/zip.ts";

test("crc32 matches the known hello value and the archive names its files", () => {
  assert.equal(crc32(Buffer.from("hello")), 0x3610a686);
  const archive = zipStore([{ name: "audit.json", data: Buffer.from('{"ok":true}') }]);
  assert.equal(archive.subarray(0, 2).toString(), "PK");
  assert.equal(archive.includes(Buffer.from("audit.json")), true);
});
