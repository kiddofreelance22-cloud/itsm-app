import { getCachedValue, invalidateCachedValue } from "./in-memory-cache.util";

describe("in-memory cache", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("reuses cached results and deduplicates concurrent loads", async () => {
    const load = jest.fn().mockResolvedValue(["value"]);
    const first = getCachedValue("test:dedupe", 1000, load);
    const concurrent = getCachedValue("test:dedupe", 1000, load);

    await expect(Promise.all([first, concurrent])).resolves.toEqual([["value"], ["value"]]);
    await expect(getCachedValue("test:dedupe", 1000, load)).resolves.toEqual(["value"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads after expiration and explicit invalidation", async () => {
    jest.useFakeTimers();
    const load = jest.fn().mockResolvedValueOnce(["first"]).mockResolvedValue(["next"]);

    await expect(getCachedValue("test:expiry", 1000, load)).resolves.toEqual(["first"]);
    jest.advanceTimersByTime(1001);
    await expect(getCachedValue("test:expiry", 1000, load)).resolves.toEqual(["next"]);
    invalidateCachedValue("test:expiry");
    await expect(getCachedValue("test:expiry", 1000, load)).resolves.toEqual(["next"]);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("does not cache rejected loads", async () => {
    const load = jest.fn()
      .mockRejectedValueOnce(new Error("load failed"))
      .mockResolvedValueOnce(["recovered"]);

    await expect(getCachedValue("test:error", 1000, load)).rejects.toThrow("load failed");
    await expect(getCachedValue("test:error", 1000, load)).resolves.toEqual(["recovered"]);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
