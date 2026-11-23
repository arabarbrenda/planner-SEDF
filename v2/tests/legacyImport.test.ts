import { describe, expect, it } from "vitest";
import { validateLegacyData, type LegacyData } from "../src/features/LegacyImport";

const validBackup = (): LegacyData => ({
  materias: [{ nome: "Direito", topicos: [{ nome: "Constitucional", questoesTotal: 10, questoesAcertos: 7 }] }],
  registrosEstudo: [{ data: "2026-11-23", tempo: 60 }],
  simulados: [{ nome: "Simulado", data: "2026-11-23", qTotal: 10, qAcertos: 8 }],
  jurisprudencia: [{ tema: "Tema repetitivo" }]
});

describe("legacy V1 backup validation", () => {
  it("accepts a structurally valid backup", () => {
    expect(() => validateLegacyData(validBackup())).not.toThrow();
  });

  it("rejects missing required collections", () => {
    const backup = validBackup();
    delete backup.registrosEstudo;
    expect(() => validateLegacyData(backup)).toThrow("backup JSON válido");
  });

  it("rejects a discipline without a name", () => {
    const backup = validBackup();
    backup.materias![0].nome = "  ";
    expect(() => validateLegacyData(backup)).toThrow("precisa ter nome");
  });

  it("rejects a topic without a name", () => {
    const backup = validBackup();
    backup.materias![0].topicos![0].nome = " ";
    expect(() => validateLegacyData(backup)).toThrow("está sem nome");
  });

  it("rejects topic correct answers greater than its total", () => {
    const backup = validBackup();
    backup.materias![0].topicos![0].questoesAcertos = 11;
    expect(() => validateLegacyData(backup)).toThrow("totais de questões");
  });

  it("rejects malformed mock exam records", () => {
    const backup = validBackup();
    backup.simulados = [null] as unknown as LegacyData["simulados"];
    expect(() => validateLegacyData(backup)).toThrow("estrutura ou um nome inválido");
  });

  it("rejects mock exam correct answers greater than its total", () => {
    const backup = validBackup();
    backup.simulados![0].qAcertos = 11;
    expect(() => validateLegacyData(backup)).toThrow("quantitativos do simulado");
  });

  it("rejects malformed jurisprudence collections", () => {
    const backup = validBackup();
    backup.jurisprudencia = "not-an-array" as unknown as LegacyData["jurisprudencia"];
    expect(() => validateLegacyData(backup)).toThrow("lista de jurisprudência");
  });

  it("rejects malformed study session records", () => {
    const backup = validBackup();
    backup.registrosEstudo = [null] as unknown as LegacyData["registrosEstudo"];
    expect(() => validateLegacyData(backup)).toThrow("sessão de estudo");
  });
});
