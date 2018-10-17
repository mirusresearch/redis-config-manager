import { serial as test } from 'ava';
const _ = require('lodash');
const RedisConfigManager = require('../../');
const TESTSRC = 'super-dope-test';
const TESTKEYCOUNT = 100;
const TESTKEYPREFIX = 'test-key-';
const sources = {
    label: 'test-instance',
    scanCount: 10,
    hashKeyPrefix: 'weirdo-hash-prefix-test',
    hashKey: TESTSRC,
    client: {
        client_override: require('redis-mock').createClient(),
    },
    listeners: {
        // debug : (...args) => { console.log(...args) }
    },
};
const dupedSources = _.clone(sources);

const RCM = new RedisConfigManager(sources);

test.before(async t => {
    await RCM.init();
});

test.beforeEach(async t => {
    t.context.rcm = RCM;
});

test.after(t => { });

test('SET a config', async t => {
    const result = await RCM.setConfig(`${TESTKEYPREFIX}0`, { foo: 'quux' });
    t.true(result);
});

test('Verify original params are not altered by instantiation', async t => {
    t.true(_.isEqual(sources, dupedSources));
});

test('HAS a config key', async t => {
    await RCM.keyRefresh();
    const result = await RCM.hasConfigKey(`${TESTKEYPREFIX}0`);
    t.true(result);
});

test('GET a config', async t => {
    const payload = await RCM.getConfig(`${TESTKEYPREFIX}0`);
    t.is(payload.foo, 'quux');
});

test('GET multiple configs', async t => {
    const payload = await RCM.getConfigs([`${TESTKEYPREFIX}0`, `${TESTKEYPREFIX}BADBADBAD`]);
    t.is(payload[0].foo, 'quux');
    t.is(payload[1], null);
});

test('DELETE a config', async t => {
    const result = await RCM.delConfig(`${TESTKEYPREFIX}0`);
    t.true(result);
});

test('get all config keys', async t => {
    const range = [...Array(TESTKEYCOUNT).keys()];
    const promises = range.map(idx => {
        return RCM.setConfig(`${TESTKEYPREFIX}${idx}`, { foo: 'bar', idx });
    });
    await Promise.all(promises);
    await RCM.keyRefresh();
    t.is(t.context.rcm.activeConfigKeys.size, TESTKEYCOUNT);
});
