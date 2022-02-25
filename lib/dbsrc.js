import fg from 'fast-glob';
import fs from 'fs';
import path from 'path';
import util from 'util';

// работает только когда запущено приложение основное (где используется этот пакет, как модуль)
const cwdnm = path.join(process.cwd(), 'node_modules').replace(/\\/g, '/');
const cacheSchPaths = {};

/**
 * Поиск расположения (полный путь) исходников объектов схемы базы данных
 *
 * @param {string} schema - имя схемы бд
 * @return {Promise<string>}
 */
async function getSchemaModule(schema) {
    if (schema in cacheSchPaths && cacheSchPaths[schema]) return cacheSchPaths[schema];
    let res;
    const dirPattern = `*/**/dbsrc/${schema}`;
    const schemaDirs = await fg(dirPattern, {
        cwd: cwdnm,
        onlyDirectories: true,
        followSymbolicLinks: true
    });
    if (schemaDirs.length === 1) {
        const [pt] = schemaDirs;
        const mdl = path.dirname(path.dirname(pt));
        cacheSchPaths[schema] = mdl;
        res = mdl;
    }
    return res;
}

/**
 * Возвращает исходник таблицы базы данных приложения
 *
 * @param {string} schema - имя схемы бд
 * @param {string} table - имя таблицы
 * @return {Promise<Object>}
 */
async function getTable(schema, table) {
    let pth, res;
    if (schema) {
        pth = await getSchemaModule(schema);
        if (pth) pth = path.join(pth, 'dbsrc', schema, 'src', 'table', `${table}.sql`);
    } else {
        const tablePattern = `*/**/dbsrc/*/src/table/${table}.sql`;
        const fnd = await fg(tablePattern, {
            cwd: cwdnm,
            followSymbolicLinks: true
        });
        if (fnd.length === 1) pth = fnd[0];
    }
    if (pth) {
        const fullPth = path.join(cwdnm, pth);
        const fdata = await util.promisify(fs.readFile)(fullPth, 'utf8');
        res = JSON.parse(fdata);
    }
    return res;
}

/**
 * Возвращает исходник колонки таблицы базы данных приложения
 *
 * @param {string} schema - имя схемы бд
 * @param {string} table - имя таблицы
 * @param {string} column - имя колонки
 * @return {Promise<Object>}
 */
async function getColumn(schema, table, column) {
    const tbl = await getTable(schema, table);
    let res;
    if (tbl) res = tbl.cols.find((f) => f.name === column);
    return res;
}

export {
    getSchemaModule,
    getTable,
    getColumn,
};
