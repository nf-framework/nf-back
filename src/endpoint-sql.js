import AbortController from 'node-abort-controller';
import { config, api, container, extension } from '@nfjs/core';
import { query } from '../lib/dbapi.js';
import { compileEndpointText } from './compiler.js';
import fs from 'fs/promises';

const endpointSqlDir = 'endpoint/sql/';
const debugIncludeToResponse = config?.debug?.includeToResponse ?? false;
const { loggerDataEndpoints } = config?.['@nfjs/back'] || {};
const appName = '{applicationName}[{instanceName}]:sqlPath[{sqlPath}]';

/**
 * Обработка запроса выполнения действия по запрашиваемому sql файлу
 * Ответ от провайдера ожидается в виде объекта {data:[],debug:{},error:""} (error и data взаимно исключают друг друга)
 * Отправляемый объект {data:[],debug:{},error:""}
 * @param {RequestContext} context - контекст запроса к серверу
 * @returns {Promise<{data:[],debug:{},error:""}>}
 */
export async function endpointSql(context) {
    let resp, file;
    const { args, control, sqlPath } = context.req.body;
    const controller = new AbortController();
    const signal = controller.signal;
    context.req.on('aborted', () => {
        controller.abort();
    });

    try {
        // поиск sql файла с учетом порядка подключения модулей
        // TODO cache?
        file = await extension.getFiles(endpointSqlDir + sqlPath + '.sql');
        if (!file) throw new Error(`sql [${sqlPath}] not found.`);
        let text = await fs.readFile(file, 'utf8');
        //
        let options = {};
        const lines = text.split('\n');
        if (lines[0].startsWith('--[options]')) {
            options = JSON.parse(lines[0].substr(11));
            text = lines.splice(1).join('\n');
        }
        // вставка в параметры запрошенных переменных из сессии пользователя
        if (options?.session) {
            const serverArgs = {};
            options.session.reduce((acc, cur) => {
                if (typeof cur === 'string') {
                    acc[cur] = context.session.get(`context.${cur}`);
                } else if (Array.isArray(cur)) {
                    acc[cur[0]] = context.session.get(`context.${cur[1]}`);
                }
                return acc;
            }, serverArgs);
            if (Object.keys(serverArgs).length > 0) Object.assign(args, serverArgs);
        }
        // вычисление финального sql, если в нем использовалась шаблонизация handlebars
        text = await compileEndpointText(text, args);
        const _provider = control?.provider || options?.provider || 'default';
        const connectPlace = (!!appName)
            ? appName.replace(/{sqlPath}/g, sqlPath)
            : undefined;
        resp = await query(text, args,{ signal, provider: _provider, context, connectPlace }, control);
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