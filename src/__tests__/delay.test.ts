import { delay } from "../utils/delay";

describe("delay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns a Promise", () => {
    const result = delay(100);
    expect(result).toBeInstanceOf(Promise);
    jest.runAllTimers();
  });

  it("resolves after the specified number of milliseconds", async () => {
    const ms = 500;
    const promise = delay(ms);

    jest.advanceTimersByTime(ms);
    await expect(promise).resolves.toBeUndefined();
  });

  it("does not resolve before the timeout completes", async () => {
    const ms = 1000;
    let resolved = false;
    const promise = delay(ms).then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(ms - 1);
    // Allow any microtasks to run
    await Promise.resolve();
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it("resolves with undefined", async () => {
    const promise = delay(0);
    jest.runAllTimers();
    const result = await promise;
    expect(result).toBeUndefined();
  });

  it("works with zero delay", async () => {
    const promise = delay(0);
    jest.runAllTimers();
    await expect(promise).resolves.toBeUndefined();
  });
});
