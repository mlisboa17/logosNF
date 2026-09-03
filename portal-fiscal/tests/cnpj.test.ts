import test from "node:test";
import assert from "node:assert/strict";
import { formatCnpj, normalizeCnpj, onlyDigits } from "../src/lib/fiscal/cnpj.ts";

test("normaliza e formata um CNPJ válido", () => {
  assert.equal(onlyDigits("04.284.939/0001-86"), "04284939000186");
  assert.equal(normalizeCnpj("04.284.939/0001-86"), "04284939000186");
  assert.equal(formatCnpj("04284939000186"), "04.284.939/0001-86");
});

test("rejeita CNPJ inválido", () => {
  assert.throws(() => normalizeCnpj("00.000.000/0000-00"));
});
