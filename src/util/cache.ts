import NodeCache from "node-cache";

const cache = new NodeCache();

export const get =
  <Data>(key: string) =>
    cache.get<Data>(key);

export const set =
  <Data>(key: string, val: Data, ttlSec: number) =>
    cache.set<Data>(key, val, ttlSec);
