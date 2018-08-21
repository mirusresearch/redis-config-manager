# redis-config-manager [![Build Status](https://travis-ci.org/mirusresearch/redis-config-manager.svg?branch=master)](https://travis-ci.org/mirusresearch/catbox-disk)
A thin nodejs API wrapper for [redis](https://redis.io/) used to store JSON serialized strings under [hash](https://redis.io/commands#hash) subkeys.

### Features:
- Stores a regularly refreshed local [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) in memory of all available keys `.activeConfigKeys`
- Uses non-blocking [HSCAN](https://redis.io/commands/hscan) commands to get the list of hash keys
- Uses [node-redis](https://github.com/NodeRedis/node_redis) module under the hood for its redis client
- Uses [redis-mock](https://github.com/yeahoffline/redis-mock) for local testing without a redis instance

### Installation:
Go into your no
`yarn add redis-config-manager`
or
`npm install redis-config-manager`

### Example
See `test/unit/rcm.spec.js` for more examples.
```javascript
const RedisConfigManager = require('redis-config-manager');
const source = {
    label: 'rando-name',            // generic name for this instance used in testing
    scanCount : 1000,               // max number of hash subkeys per HSCAN operation
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

### Commands & Properties:
|Signature| Description | Returns | async/Promise |
|---------|-------------|---------|---------------|
|`.init()`| Initialize the manager, redis connection, active keys, etc | Yes |
|`.setConfig(key,value)` | JSON serializes js object of `value` and writes/overwrites the string hash subkey of `key`| `Boolean true` | Yes |
|`.getConfig(key)` | If the string of `key` is a valid subkey to the hash, will return the JSON.parse value of the string value stored | `Object` | Yes |
|`.delConfig(key)` | Attempts to delete string subkey of `key` from the hash.  Missing keys produce no error | `Boolean` | Yes |
| `.hasConfigKey(key)`| Checks the locally stored Set of `.activeConfigKeys` for a existence of a key | `Boolean` | No |
| `.keyRefresh()` | Forces a refresh of `.activeConfigKeys` outside of the predefined refresh intervals | `undefined` | Yes |
| `.activeConfigKeys`| Returns a Set of most recently refereshed key names | `Set` | No |

### `source` object properties
_All are optional unless otherwise noted_

| Property  |Type| Required | Default   | Description |
|-----------|----|----------|-----------|-------------|
|`label`   | `String` |  |`NO-LABEL RedisConfigManager Instance` | Readable identifier for debugging. |
|`hashKey` | `String` | **Yup**|`undefined`| Suffix to append to the base prefix keyname (`redis-config-manager:`) of managed hashes |
|`scanCount`| `String` | | 1000 | Number of subkeys scanned per `HSCAN - see the [count option](https://redis.io/commands/scan#the-count-option) for details |
|`refreshInterval`| `Integer`| | 15000 | Number of milliseconds between key refreshes |
|`fixtureData` | `Object` | | `undefined` | A simple/json-serializable object to be preloaded upon instantiation.  See below for more detail.|
| `listeners` |  `Object` | | `no-op` & `console` | `A key/function object for event listeners of `debug`,`ready`,`error`|
| `client` | `Object`| | `{host:'127.0.0.1', port:6379}` | Parameters for the [node-redis](https://github.com/NodeRedis/node_redis#options-object-properties) client|
| `client.module_override` | `Function` | | `undefined` | replaces built-in `require('node_redis')` (maybe a new branch, custom version you're using)|
| `client.client_override` | `Function` | | `undefined` | Re-use an existing `node_redis` client instance rather than using its own. (used during testing with [redis-mock](https://github.com/yeahoffline/redis-mock))|

### Contributions & Development:
Install with dev packages and run `yarn test` or `npm test`

PRs are welcome.


###TODO:
Write some todos.
