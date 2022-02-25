/* eslint-env mocha */

const { expect } = require('chai');
const dbsrc = require('../dbsrc');

describe('lib/dbsrc', () => {
    describe('getSchemaModule()', () => {
        it('nfc', async () => {
            const res = await dbsrc.getSchemaModule('nfc');
            expect(res).to.equal('@nfjs/back-dbfw');
        });
    });
    describe('getTable()', () => {
        it('nfc, unitlist', async () => {
            const tbl = await dbsrc.getTable('nfc', 'unitlist');
            expect(tbl).to.be.a('Object');
            const { comment } = tbl;
            expect(comment).to.equal('Разделы системы');
        });
        it('undefined, unitlist', async () => {
            const tbl = await dbsrc.getTable(undefined, 'unitlist');
            expect(tbl).to.be.a('Object');
            const { comment } = tbl;
            expect(comment).to.equal('Разделы системы');
        });
    });
    describe('getColumn()', () => {
        it('nfc, unitlist, caption', async () => {
            const clmn = await dbsrc.getColumn('nfc', 'unitlist', 'caption');
            expect(clmn).to.be.a('Object');
            const { comment } = clmn;
            expect(comment).to.equal('Наименование');
        });
    });
});