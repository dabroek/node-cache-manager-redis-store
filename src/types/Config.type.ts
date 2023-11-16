import {RedisClientOptions} from "redis";
import {Config} from "cache-manager";

export type TConfig = RedisClientOptions & Config;
