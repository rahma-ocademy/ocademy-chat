import { describe, expect, it } from "vitest";
import { parseConfig, parseInstructions, parseRouting } from "./config";

describe("AI agent config", () => {
  it("default untuk baris kosong", () => {
    expect(parseConfig({})).toEqual({
      stop_after_transfer: true,
      silent_transfer: false,
      timezone: "Asia/Jakarta",
      history_limit: 20,
      context_limit: 10,
      creativity: "consistent",
      message_await_seconds: 5,
      message_limit: 1000,
      session_only_memory: false,
    });
    expect(parseConfig(null).history_limit).toBe(20);
  });

  it("nilai di luar batas kembali ke default, nilai valid dipertahankan", () => {
    const c = parseConfig({ history_limit: 500, context_limit: "12", creativity: "wild", silent_transfer: true });
    expect(c.history_limit).toBe(20);
    expect(c.context_limit).toBe(12);
    expect(c.creativity).toBe("consistent");
    expect(c.silent_transfer).toBe(true);
  });

  it("routing parsial", () => {
    expect(parseRouting({ transfer: { enabled: true, condition: "minta admin" } })).toEqual({
      transfer: { enabled: true, condition: "minta admin" },
      label: { enabled: false, condition: "" },
    });
  });

  it("instruksi tambahan: buang yang tidak valid", () => {
    expect(parseInstructions([{ condition: "", instruction: "Selalu sapa Kak" }, { condition: "x" }, "y"])).toEqual([{ condition: "", instruction: "Selalu sapa Kak" }]);
    expect(parseInstructions(undefined)).toEqual([]);
  });
});
