const EventEmitter = require('events');
const HASHPREFIX = 'redis-config-manager:';

module.exports = class RedisConfigManager extends EventEmitter {

    constructor (params){
        super();

        // general configuration
        const paramDefaults = {
            label:`NO-LABEL RedisConfigManager Instance`,
            raygun: () => {},
            hashKey: undefined,
            scanCount: 1000,
            refreshInterval: 1000*15,
            fixtureData: undefined,
            listeners: {
                // 'debug' : (...args) => { console.log(...args) },
                'debug' : () => { },
                'ready' : (...args) => { console.log(...args) },
                'error' : (...args) => { console.error(...args) },
            },
        };
        const redisDefaults = {
            host:"127.0.0.1",
            port:6379,
            db:0,
            module_override: undefined,
            client_override: undefined,
        };

        this.redisParams = Object.assign({},redisDefaults,params.client);
        delete params.client;

        this.options = Object.assign({},paramDefaults,params);
        this.options.hashKey = `${HASHPREFIX}${this.options.hashKey}`;

        this.raygun = this.options.raygun;

        // local state
        this.activeConfigKeys = new Set([]);
        this.activeConfigKeysLastUpdate = null;
    }

    async init () {
        this.initEventListeners();
        await this.initRedisClient();
        this.initAsyncCommands();
        await this.loadFixtureData();
        await this.initKeyRefresh();
        this.emit('debug','---> init completed');
    }

    initEventListeners () {
        if (!this.options.listeners){
            return;
        }
        for (const key of Object.keys(this.options.listeners)) {
            this.on(key,this.options.listeners[key]);
        }
    }

    isConnected () {
        return this.redisClient && this.redisClient.connected;
    }

    initRedisClient (){
        const self = this;
        const redisModule = this.redisParams.module_override || require('redis');
        this.redisClient = this.redisParams.client_override || redisModule.createClient(this.redisParams);

        return new Promise((resolve,reject)=>{
            this.redisClient
                .on('error', error => {
                    const msg =  `Redis error => ${self.options.label} : ${error.message}`;
                    self.raygun(msg,null,self.options);
                    // self.emit('error',`Redis error => ${self.options.label} : ${error.message}`);
                })
                .on('ready', ()=> {
                    if (this.options.db){
                        self.redisClient.select(self.redisParams.db);
                    }
                    let msg = `Redis connected => ${self.options.label} to redis://${self.redisClient.address || 'mock_redis_instance'}`;
                    if (this.options.db > 0) {
                        msg += `/db${self.redisParams.db}`;
                    }
                    if (self.redisClient.server_info && self.redisClient.server_info.redis_version) {
                        msg += ` v${self.redisClient.server_info.redis_version}`;
                    }
                    self.emit('ready',msg);
                    resolve();
                });
            if (this.isConnected()){ // handles pre-existing clients that may already be connected;
                resolve();
            }
        });
    }

    initAsyncCommands () {
        const self = this;
        const {promisify} = require('util');
        const commands = ['ping','hget','hset','hdel','hscan'];
        this.cmd = commands.reduce((o, key) => ({ ...o, [key]: promisify(self.redisClient[key]).bind(self.redisClient) }), {});
    }


    async initKeyRefresh () {
        const self = this;
        await self.keyRefresh();
        setInterval(self.keyRefresh.bind(self), self.options.refreshInterval);
    }

    async keyRefresh () {
        const self = this;
        if (!self.isConnected()){
            self.emit('error', `No connection for ${self.options.label}, not updating keys...`);
            return;
        }
        self.emit('debug', `Updating config keys for ${self.options.label} ...`);
        let cursor;
        let allKeys = [];
        while (cursor !== '0') {
            let found;
            [cursor, found] = await self.cmd.hscan(self.options.hashKey, parseInt(cursor || '0'), 'count', self.options.scanCount);
            let scanKeys = found?found.filter((element, idx) => idx % 2 === 0):[];
            allKeys = allKeys.concat(scanKeys);
        }
        self.activeConfigKeys = new Set(allKeys);
        this.activeConfigKeysLastUpdate = new Date();
        self.emit('debug', `Config Keys updated for ${self.options.label }:`, self.activeConfigKeys );
    }

    hasConfigKey (key) {
        return this.activeConfigKeys.has(key);
    }

    async getConfig (key) {
        this.emit('debug', `getConfig: ${key}`);

        const json = await this.cmd.hget(this.options.hashKey, key);
        this.emit('debug', `getConfig ${this.options.hashKey}, ${key}, ${json}`);
        return JSON.parse(json);
    }

    async setConfig (key, value) {
        value.last_updated = new Date().getTime();
        const serialized = JSON.stringify(value);
        await this.cmd.hset(this.options.hashKey, key, serialized);
        return true;
        this.emit('debug', `setConfig ${this.options.hashKey}, ${key}, ${serialized}`);
    }

    async delConfig (key) {
        await this.cmd.hdel(this.options.hashKey, key);
        return true;
    }

    async loadFixtureData () {
        const self = this;
        if (!this.options.fixtureData) {
            return;
        }
        for (const key of Object.keys(this.options.fixtureData)) {
            const config = this.options.fixtureData[key];
            await self.setConfig(key,config);
            self.emit('debug',`Fixture Data loaded for ${self.options.label }: ${key}`);
        }
    }
};
