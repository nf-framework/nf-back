import assert from 'assert';
import * as testing from '../endpoint-action.js';

describe('@nfjs/back/src/enpoint-action', () => {
    describe('sortOn()', () => {
        it('simple', () => {
            assert.strictEqual(testing.sortOn({order:2},{order:1}), 1);
            assert.strictEqual(testing.sortOn({order:1},{order:2}), -1);
            assert.strictEqual(testing.sortOn({order:2},{order:2}), 0);
        });
        it('order vs undefined', () => {
            assert.strictEqual(testing.sortOn({order:2},{}), -1);
            assert.strictEqual(testing.sortOn({},{order:2}), 1);
        });
        it('filter', () => {
            assert.strictEqual(testing.sortOn({filter:'each'},{filter:'add'}), -3);
            assert.strictEqual(testing.sortOn({filter:'upd'},{filter:'del'}), 1);
        });
        it('combo', () => {
            assert.strictEqual(testing.sortOn({filter:'each'},{order:5, filter:'add'}), 1);
            assert.strictEqual(testing.sortOn({filter:'upd', order:1},{filter:'del'}), -1);
        });
    });
});
describe('@nfjs/back/src/enpoint-action', () => {
    describe('convertToNfAction()', () => {
        it('without on', () => {
            // Arrange
            const source = {
                '@main': {
                    action: 'mdl.unit.add',
                    provider: 'default',
                    type: 'broker',
                    serverArgs: "_compose('org',@org)",
                    out: 'id'
                }
            };
            // Act
            let res = {};
            testing.convertToNfAction(source, res);
            // Assert
            assert.strictEqual(res?.attributes?.action, 'mdl.unit.add');
            assert.strictEqual(res?.serverAttributes?.args, "_compose('org',@org)");
        });
        it('on. default order', () => {
            // Arrange
            const source = {
                '@main': {
                },
                sub1: {
                    '@add': [
                        {
                            action: 'mdl.unitsub1.add',
                            type: 'broker',
                            args: {pid: '/id', '...': '*'},
                        },
                    ],
                    '@del': [
                        {
                            action: 'mdl.unitsub1.del',
                            type: 'broker',
                            args: {id: '*.id'},
                        }
                    ]
                }
            };
            // Act
            let res = {};
            testing.convertToNfAction(source, res);
            // Assert
            assert.strictEqual(res?.on?.[0]?.attributes?.action, 'mdl.unitsub1.del');
            assert.strictEqual(res?.on?.[1]?.attributes?.action, "mdl.unitsub1.add");
        });
        it('all', () => {
            // Arrange
            const source = {
                '@main': [
                    {
                        action: 'mdl.unit.add',
                        provider: 'default',
                        type: 'broker',
                        serverArgs: "_compose('org',@org)",
                        out: 'id'
                    }
                ],
                sub1: {
                    '@add': [
                        {
                            action: 'mdl.unitsub1.add',
                            provider: 'default',
                            type: 'broker',
                            args: {pid: '**.id', '...': '*'},
                            out: 'id'
                        },
                        {
                            action: 'mdl.unitsub1_ext.add',
                            type: 'broker',
                            args: {pid: '/sub1.id', '...': '*'}
                        }
                    ],
                    "@upd;each": [
                        {
                            action: 'mdl.unitsub1.upd',
                            type: 'broker',
                            args: {'...': '*'},
                            order: 2
                        }
                    ],
                    '@del': [
                        {
                            action: 'mdl.unitsub1.upd',
                            type: 'broker',
                            args: {id: '*.id'},
                            order: 1
                        }
                    ],
                    sub2: {
                        '@add': [
                            {
                                action: 'mdl.unitsub2.add',
                                type: 'broker',
                                args: {pid: '**.id', '...': '*'}
                            }
                        ],
                    }
                }
            };
            // Act
            let res = {};
            testing.convertToNfAction(source, res);
            // Assert
            assert.deepStrictEqual(res.on.length, 6);
        });
    });
});