export function delay(ms) {
  new Promise((res) => setTimeout(res, ms));
}
