# redis-config-manager [![Build Status](https://travis-ci.org/mirusresearch/redis-config-manager.svg?branch=master)](https://travis-ci.org/mirusresearch/redis-config-manager)
A thin nodejs API wrapper for [redis](https://redis.io/) used to store JSON serialized strings under [hash](https://redis.io/commands#hash) subkeys.

### Breaking changes for 1.2.x:
We're removing the local key storage and lookup capability - we kept running into issues with the reliability of HSCAN over large key spaces. This is probably due to our implementation more than redis, but it was causing production issues.  We'll miss the cheap/fast syncronous lookup that `.activeConfigKeys` gave us, but we'll also avoid false negatives due to slow/failed refreshes of the config keys.  We should also get a smaller module footprint in memory without the local config key Set.


### Features:
- Keeps your redis instance root namespace clean by storing everything under one hash key, with subkeys as your main identifier
- Handles the JSON encode/decode cycle internally
- Event emitters let you set listeners as needed for handling errors the way you want
- Uses [node-redis](https://github.com/NodeRedis/node_redis) module under the hood for its redis client
- Uses [redis-mock](https://github.com/yeahoffline/redis-mock) for local testing without a redis instance

### Installation:
Go into your
`yarn add redis-config-manager`
or
`npm install redis-config-manager`

### Example
See `test/unit/rcm.spec.js` for more examples.
```javascript
const RedisConfigManager = require('redis-config-manager');
const source = {
    label: 'rando-name',            // generic name for this instance used in testing
    hashKey: 'rando-key-suffix',   // Suffix used in the hash key storing the data
    client: {
        host: '127.0.0.1',
        port: 6379
        // any other redis client-specific parameters
    },
};
const RCM = new RedisConfigManager(source);
await RCM.init();
await RCM.setConfig('foo',{bar:'quux'});
```

### Methods & Properties:
|Signature| Description | Returns | async/Promise | Deprecated |
|---------|-------------|---------|---------------|------------|
|`.init()`| Initialize the manager, redis connection, active keys, etc | Yes |
|`.setConfig(key,value)` | JSON serializes js object of `value` and writes/overwrites the string hash subkey of `key`| `Boolean true` | Yes |
|`.getConfig(key)` | If the string of `key` is a valid subkey to the hash, will return the JSON.parse value of the string value stored | `Object` | Yes |
|`.getConfigs(keys)` | Provided an array of strings via the `keys` argument, will return an array of results in matching order as the keys.  When a non-null value exists for a key, JSON.parse is attempted | `Array` | Yes |
|`.delConfig(key)` | Attempts to delete string subkey of `key` from the hash.  Missing keys produce no error | `Boolean` | Yes |
| ~~`.hasConfigKey(key)`~~| Checks the locally stored Set of `.activeConfigKeys` for a existence of a key | `Boolean` | No | **Deprecated in v1.2.x** |
| ~~`.keyRefresh()`~~ | Forces a refresh of `.activeConfigKeys` outside of the predefined refresh intervals | `undefined` | Yes | **Deprecated in v1.2.x** |
| ~~`.activeConfigKeys`~~| Returns a Set of most recently refereshed key names | `Set` | No | **Deprecated in v1.2.x** |

### `source` object properties
_All are optional unless otherwise noted_

| Property  |Type| Required | Default   | Description | Deprecated |
|-----------|----|----------|-----------|-------------|------------|
| `label`   | `String` |  |`NO-LABEL RedisConfigManager Instance` | Readable identifier for debugging. |
| `hashKey` | `String` | **Yup**|`undefined`| Suffix to prepended to `hashKeyPrefix` |
| `hashKeyPrefix` | `String` | |`redis-config-manager:`| Prefix for the hash key managed by this instance -- typically left as-is unless you have a pre-existing hash you want to use |
| `fixtureData` | `Object` | | `undefined` | A simple/json-serializable object to be preloaded upon instantiation.  See below for more detail.|
| `listeners` |  `Object` | | `no-op` & `console` | `A key/function object for event listeners of `debug`,`ready`,`error`|
| `client` | `Object`| | `{host:'127.0.0.1', port:6379}` | Parameters for the [node-redis](https://github.com/NodeRedis/node_redis#options-object-properties) client|
| `client.module_override` | `Function` | | `undefined` | replaces built-in `require('node_redis')` (maybe a new branch, custom version you're using)|
| `client.client_override` | `Function` | | `undefined` | Re-use an existing `node_redis` client instance rather than using its own. (used during testing with [redis-mock](https://github.com/yeahoffline/redis-mock))|
| ~~`disableLocalKeyStorage`~~| `Boolean` | | `false` | Eliminate local keys storage - lower memory, less logic, faster startup, slight reduction in functionality | **Deprecated in v1.2.x** |
| ~~`useBlockingKeyRefresh`~~| `Boolean` | | `false` | Use blocking `HKEYS` - see the [hkeys option](https://redis.io/commands/hkeys) for details | **Deprecated in v1.2.x** |
| ~~`scanCount`~~| `String` | | 1000 | Number of subkeys scanned per `HSCAN` - see the [count option](https://redis.io/commands/scan#the-count-option) for details | **Deprecated in v1.2.x** |
| ~~`refreshInterval`~~| `Integer`| | 15000 | Number of milliseconds between key refreshes | **Deprecated in v1.2.x** |

### Contributions & Development:
Install with dev packages and run `yarn test` or `npm test`

PRs are welcome.


###TODO:
Write some todos.
