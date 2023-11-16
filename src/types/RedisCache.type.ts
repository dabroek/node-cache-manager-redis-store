import {Cache} from "cache-manager";
import {RedisStore} from "./RedisStore.interface";

export type RedisCache = Cache<RedisStore>;
