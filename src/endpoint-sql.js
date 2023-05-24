import AbortController from 'node-abort-controller';
import { config, api, container, extension } from '@nfjs/core';
import { query } from '../lib/dbapi.js';
import fs from 'fs/promises';

const endpointSqlDir = 'endpoint/sql/';
const debugIncludeToResponse = config?.debug?.includeToResponse ?? false;
let { loggerDataEndpoints, appNameEndpointSql } = config?.['@nfjs/back'] || {};
if (appNameEndpointSql === 'default') appNameEndpointSql = '{applicationName}[{instanceName}]:sqlPath[{sqlPath}]';

/**
 * @typedef NfExecuteSqlResult
 * @property {Object} [data] выходные данные при удачном выполнении
 * @property {Object|string} [error] информация об ошибке, если выполнение неудачно
 * @property {Object} [debug] отладочная информация
 */

/**
 * Выполнение sql из файла
 * @param {string} sqlPath относительный путь к sql файлу, где вместо "/" использованы "."
 * @param {Object} params параметры выполнения
 * @param {BackApiProviderQueryOptions} options настройки формирования отдаваемых данных и прочее, что не касается самого текста запроса
 * @param {ProviderQueryControl} [control] настройки для преобразования запроса до готового к выполнению состоянию
 * @returns {Promise<NfExecuteSqlResult>}
 */
export async function executeSql(sqlPath, params, options, control) {
    let resp, file;
    try {
        // поиск sql файла с учетом порядка подключения модулей
        // TODO cache?
        file = await extension.getFiles(endpointSqlDir + sqlPath.replace(/\./g, '/') + '.sql');
        if (!file) throw new Error(`sql [${sqlPath}] not found.`);
        let text = await fs.readFile(file, 'utf8');
        //
        let sqlOptions = {};
        const lines = text.split('\n');
        if (lines[0].startsWith('--[options]')) {
            sqlOptions = JSON.parse(lines[0].substr(11));
            text = lines.splice(1).join('\n');
        }
        // вставка в параметры запрошенных переменных из сессии пользователя
        if (sqlOptions?.paramsFromSession) {
            const serverArgs = {};
            sqlOptions.paramsFromSession.reduce((acc, cur) => {
                if (typeof cur === 'string') {
                    acc[cur] = options.context.session.get(`context.${cur}`);
                } else if (Array.isArray(cur)) {
                    acc[cur[0]] = options.context.session.get(`context.${cur[1]}`);
                }
                return acc;
            }, serverArgs);
            if (Object.keys(serverArgs).length > 0) Object.assign(params, serverArgs);
        }
        const outerProvider = options?.provider || control?.provider;
        let innerProviders = sqlOptions?.provider || 'default';
        if (!Array.isArray(innerProviders)) innerProviders = [innerProviders];
        let provider;
        // проверить, что указанный снаружи провайдер разрешен
        if (outerProvider) {
            if (innerProviders.includes(outerProvider)) {
                provider = outerProvider;
            } else {
                throw new Error('Указанный провайдер для запроса не входит в список допустимых.');
            }
        } else {
            provider = innerProviders[0];
        }
        const defaultOptions = { returnRN: true, rowMode: 'array' };
        const queryOptions = { ...defaultOptions, ...sqlOptions, ...options };
        queryOptions.provider = provider;
        queryOptions.connectPlace = (!!appNameEndpointSql)
            ? appNameEndpointSql.replace(/{sqlPath}/g, sqlPath)
            : undefined;
        resp = await query(text, params, queryOptions, control);
        if ('debug' in resp && !debugIncludeToResponse) delete resp.debug;
    } catch (e) {
        const err = api.nfError(e);
        if (debugIncludeToResponse) {
            resp = err.json();
        } else {
            resp = { error: err.message };
        }
    }
    if (loggerDataEndpoints && container.loggers) {
        const { password, ...session_context } = context.session.get('context');
        const ip = (context.req.headers['x-forwarded-for'] || context.req?.connection?.remoteAddress || '').split(',')[0].trim();
        const logger = container.loggers.get(loggerDataEndpoints);
        logger.info('', {
            logType: 'sql',
            endpoint: sqlPath,
            file,
            control,
            args,
            error: resp.error,
            rows: resp.data && resp.data.length,
            remoteAddress: ip,
            session_context
        });
    }
    return resp;
}

/**
 * Обработка запроса выполнения действия по запрашиваемому sql файлу
 * @param {RequestContext} context - контекст запроса к серверу
 * @returns {Promise<NfExecuteSqlResult>}
 */
export async function endpointSql(context) {
    const { args, control } = context.req.body;
    const sqlPath = context?.params?.sqlPath;
    const controller = new AbortController();
    const signal = controller.signal;
    context.res.on('close', () => {
        const { destroyed, writableEnded } = context.res;
        // weird aborted status clarification
        if (destroyed && !writableEnded) {
            controller.abort();
        }
    });
    const options = { context, signal };
    return executeSql(sqlPath, args, options, control);
}