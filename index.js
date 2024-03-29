const EventEmitter = require('events');
const _ = require('lodash');

module.exports = class RedisConfigManager extends EventEmitter {
    constructor(params) {
        super();

        params = _.clone(params); // avoid mucking up the original params;
        if (!params.hashKey) {
            throw new Error('param.hashKey string required');
        }
        // general configuration
        const paramDefaults = {
            label: `NO-LABEL RedisConfigManager Instance`,
            hashKeyPrefix: 'redis-config-manager:',
            hashKey: undefined,
            refreshInterval: 1000 * 15,
            fixtureData: undefined,
            listeners: {
                debug: console.log,
                ready: console.log,
                error: console.error,
            },
        };
        const redisDefaults = {
            host: '127.0.0.1',
            port: 6379,
            db: 0,
            module_override: undefined,
            client_override: undefined,
        };

        this.redisParams = Object.assign({}, redisDefaults, params.client);
        delete params.client;
        // params = _.omit(params, ['client']);

        this.options = Object.assign({}, paramDefaults, params);

        // local state
        this.hashKey = `${this.options.hashKeyPrefix}${this.options.hashKey}`;
        this.activeConfigKeys = new Set([]);
        this.activeConfigKeysLastUpdate = null;
        this.initKeyInterval;
    }

    async init() {
        this.initEventListeners();
        await this.initRedisClient();
        this.initAsyncCommands();
        await this.loadFixtureData();
        await this.initKeyRefresh();

        this.emit('debug', '---> init completed');
    }

    stop() {
        clearInterval(this.initKeyInterval);
        this.emit('debug', '... stop completed');
    }

    initEventListeners() {
        if (!this.options.listeners) {
            return;
        }
        for (const key of Object.keys(this.options.listeners)) {
            this.on(key, this.options.listeners[key]);
        }
    }

    isConnected() {
        return this.redisClient && this.redisClient.connected;
    }

    initRedisClient() {
        const self = this;
        const redisModule = this.redisParams.module_override || require('redis');
        this.redisClient = this.redisParams.client_override || redisModule.createClient(this.redisParams);

        return new Promise((resolve, reject) => {
            this.redisClient
                .on('error', (error) => {
                    const msg = `Redis error => ${self.options.label} : ${error.message}`;
                    self.emit('error', msg);
                })
                .on('ready', () => {
                    if (this.options.db) {
                        self.redisClient.select(self.redisParams.db);
                    }
                    let msg = `Redis connected => ${self.options.label} to redis://${
                        self.redisClient.address || 'mock_redis_instance'
                    }`;
                    if (this.options.db > 0) {
                        msg += `/db${self.redisParams.db}`;
                    }
                    if (self.redisClient.server_info && self.redisClient.server_info.redis_version) {
                        msg += ` v${self.redisClient.server_info.redis_version}`;
                    }
                    self.emit('ready', msg);
                    resolve();
                });
            if (this.isConnected()) {
                // handles pre-existing clients that may already be connected;
                resolve();
            }
        });
    }

    initAsyncCommands() {
        const self = this;
        const { promisify } = require('util');
        const commands = ['ping', 'hget', 'hset', 'hdel', 'hmget', 'hkeys', 'hexists'];
        this.cmd = commands.reduce(
            (o, key) => ({ ...o, [key]: promisify(self.redisClient[key]).bind(self.redisClient) }),
            {}
        );
    }

    async initKeyRefresh() {
        const self = this;
        await self.keyRefresh();
        self.initKeyInterval = setInterval(self.keyRefresh.bind(self), self.options.refreshInterval);
    }

    async keyRefresh() {
        const allKeys = await this.cmd.hkeys(this.hashKey);
        this.activeConfigKeys = new Set(allKeys);
    }

    hasConfigKey(key) {
        return this.activeConfigKeys.has(key);
    }

    async getConfig(key) {
        const result = await this.cmd.hget(this.hashKey, key);
        this.emit('debug', `getConfig: ${this.hashKey}, ${key}, ${result}`);
        return result ? JSON.parse(result) : result;
    }

    async getConfigs(keys) {
        this.emit('debug', `getConfigs: ${keys}`);
        if (!Array.isArray(keys)) {
            throw new Error(`getConfigs requires an array of keys be passed in`);
        }
        const results = await this.cmd.hmget(this.hashKey, keys);
        this.emit('debug', `getConfigs ${this.hashKey}, ${keys}`);
        return results.map((r) => (r ? JSON.parse(r) : r));
    }

    async setConfig(key, value) {
        value.last_updated = new Date().getTime();
        const serialized = JSON.stringify(value);
        await this.cmd.hset(this.hashKey, key, serialized);
        this.emit('debug', `setConfig ${this.hashKey}, ${key}, ${serialized}`);
        return true;
    }

    async delConfig(key) {
        await this.cmd.hdel(this.hashKey, key);
        return true;
    }

    async loadFixtureData() {
        const self = this;
        if (!this.options.fixtureData) {
            return;
        }
        for (const key of Object.keys(this.options.fixtureData)) {
            const config = this.options.fixtureData[key];
            await self.setConfig(key, config);
            self.emit('debug', `Fixture Data loaded for ${self.options.label}: ${key}`);
        }
    }
};
