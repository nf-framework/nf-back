import assert from 'assert';
import { extension } from "@nfjs/core";
import { dataProviders } from '../../index.js';
import { NFTestProvider } from '../../lib/provider-test.js';
import * as testing from '../endpoint-sql.js';

dataProviders.__test = new NFTestProvider({});

describe('@nfjs/back/src/enpoint-sql', () => {
    describe('executeSql()', () => {
        it('simple', async () => {
            // Act
            await extension.load();
            const res = await testing.executeSql('back.test', {}, { context: {} });
            // Assert
            assert.strictEqual(res?.data?.[0]?.numb, 1);
        });
        it('options.returnFirst', async () => {
            // Act
            await extension.load();
            const res = await testing.executeSql('back.test', {}, { context: {}, returnFirst: true });
            // Assert
            assert.strictEqual(res?.data?.numb, 1);
        });
        it('options.provider correct', async () => {
            // Act
            await extension.load();
            const res = await testing.executeSql('back.test', {}, { context: {}, provider: '__test' });
            // Assert
            assert.strictEqual(!!res.data, true);
        });
        it('options.provider incorrect', async () => {
            // Act
            await extension.load();
            const res = await testing.executeSql('back.test', {}, { context: {}, provider: 'wrong' });
            // Assert
            assert.strictEqual(!!res.error, true);
        });
    });
});