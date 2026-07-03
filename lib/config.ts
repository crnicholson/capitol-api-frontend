// "static" serves cached trades from public/trades.json with client-side
// filtering/sorting — no backend required. Anything else (or unset) uses the
// live API at NEXT_PUBLIC_API_URL.
export const IS_STATIC_MODE = process.env.NEXT_PUBLIC_DATA_MODE === "static";
