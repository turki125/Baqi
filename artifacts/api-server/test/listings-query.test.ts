import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import express from "express";
import { ListingsHttpQuery } from "../src/lib/listings-query";

let server: Server;
let base: string;
before(async () => {
  const app = express();
  app.get("/listings", (req, res) => {
    const parsed = ListingsHttpQuery.safeParse(req.query);
    res.status(parsed.success ? 200 : 400).json(parsed.success ? parsed.data : { error: "Invalid query" });
  });
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/listings`;
});
after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

async function request(pairs: [string, string][]) {
  return fetch(`${base}?${new URLSearchParams(pairs)}`);
}

test("خشب smart search accepts one Arabic term alongside repeated English terms", async () => {
  const response = await request([
    ["category", "timber"], ["searchTermsEn", "timber"], ["searchTermsEn", "wood"], ["searchTermsAr", "خشب"],
  ]);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.searchTermsAr, ["خشب"]);
  assert.deepEqual(result.searchTermsEn, ["timber", "wood"]);
  assert.equal(result.category, "timber");
});

test("single English, repeated Arabic, and ordinary text searches remain valid", async () => {
  for (const pairs of [
    [["searchTermsEn", "cement"]],
    [["searchTermsAr", "بلاط"], ["searchTermsAr", "بيج"]],
    [["q", "خشب"]],
    [],
  ] as [string, string][][]) {
    assert.equal((await request(pairs)).status, 200);
  }
});

test("freeOnly=false stays false and omitted freeOnly stays unset", async () => {
  for (const value of ["false", "true"]) {
    const response = await request([["freeOnly", value]]);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).freeOnly, value === "true");
  }
  assert.equal((await (await request([])).json()).freeOnly, undefined);
});

test("query limits and invalid filters still return 400", async () => {
  const invalid: [string, string][][] = [
    [["searchTermsEn", "a".repeat(41)]],
    Array.from({ length: 9 }, (_, i) => ["searchTermsAr", `term${i}`]),
    [["freeOnly", "invalid"]],
    [["freeOnly", "false"], ["freeOnly", "true"]],
    [["condition", "invalid"]],
    [["minQuantity", "-1"]],
  ];
  for (const pairs of invalid) assert.equal((await request(pairs)).status, 400);
});
