export function pagination(params, key = "page") {
  const number = (value, fallback, max) => {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback;
  };
  const page = number(params.get(key), 1, 1000000);
  const limit = number(params.get("limit"), 50, 100);
  return { page, limit, offset: (page - 1) * limit };
}
