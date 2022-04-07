import AbortController from 'node-abort-controller';
import { config, api, common, container } from '@nfjs/core';
import { query } from '../lib/dbapi.js';
import { composeServerArgs } from './compose-server-args.js';

const debugIncludeToResponse = common.getPath(config, 'debug.includeToResponse') || false;
let { loggerDataEndpoints, appNameActionDataset } = config?.['@nfjs/back'] || {};
if (appNameActionDataset === 'default') appNameActionDataset = '{applicationName}[{instanceName}]:form[{form}]:id[{id}]';

/**
 * @typedef NfExecuteDatasetResult
 * @property {Object} [data] выходные данные при удачном выполнении
 * @property {Object|string} [error] информация об ошибке, если выполнение неудачно
 * @property {Object} [debug] отладочная информация
 */

/**
 * @typedef NfDataset
 * @property {string} text текст запроса к источнику данных на его языке
 * @property {Object} attributes
 * @property {string} [attributes.provider] имя источника данных
 * @property {string} [attributes.endpoint] адрес, по которому обратились к веб серверу за данными
 * @property {Object} serverAttributes
 * @property {string} [serverAttributes.args] строка, по которой в аргументы выполнения запроса добавятся значения из сессии пользователя
 */

/**
 * Обработка выполнения запроса
 * @param {RequestContext} context контекст запроса к серверу
 * @param {NfDataset} ds настройки запроса
 * @param {Object} args аргументы выполнения запроса
 * @param {ProviderQueryControl} control настройки для преобразования запроса до готового к выполнению состоянию
 * @returns {NfExecuteDatasetResult}
 */
async function handleEndpoint(context, ds, args, control) {
    const controller = new AbortController();
    const signal = controller.signal;
    context.req.on('aborted', () => {
        controller.abort();
    });
    const { session } = context;
    let { text, attributes, serverAttributes } = ds;
    const logArgs = { ...args }, logControl = { ...control };
    let resp = {};
    try {
        const serverArgs = composeServerArgs(session, serverAttributes?.args);
        if (serverArgs) Object.assign(args, serverArgs);

        const provider = (control && control.provider) || attributes.provider || 'default';
        if (provider === 'js') args.__session = session;

        const connectPlace = (!!appNameActionDataset)
            ? appNameActionDataset.replace(/{form}/g, context?.params?.form).replace(/{id}/g, context?.params?.id)
            : undefined;
        const defaultOptions = { rowMode: 'array', returnRN: true };
        const options = { ...defaultOptions, ...attributes, ...{ signal, provider, context, connectPlace } };
        resp = await query(text, args, options, control);
        if (resp && resp.debug && !debugIncludeToResponse) delete resp.debug;
    } catch (e) {
        const err = api.nfError(e);
        if (debugIncludeToResponse) {
            resp = err.json();
        } else {
            resp = { error: err.message };
        }
    }
    if (loggerDataEndpoints && container.loggers) {
        const { password, ...session_context } = session && session.session && session.session.context;
        const ip = (context.req.headers['x-forwarded-for'] || context.req.connection.remoteAddress || '').split(',')[0].trim();
        const logger = container.loggers.get(loggerDataEndpoints);
        logger.info('', {
            logType: 'dataset',
            endpoint: dsAttrs.endpoint,
            control: logControl,
            args: logArgs,
            error: resp.error,
            rows: resp.data && resp.data.length,
            remoteAddress: ip,
            session_context
        });
    }
    return resp;
}

/**
 * Обработка запроса выполнения действия от компонента nf-dataset
 * @param {RequestContext} context контекст запроса к серверу
 */
async function endpointNfDataset(context) {
    const { cachedObj: ds } = context;
    const { args = {}, control } = context.req.body;
    return handleEndpoint(context, ds, args, control);
}

/**
 * Обработка запроса выполнения действия от компонента pl-dataset
 * @param {RequestContext} context контекст запроса к серверу
 */
async function endpointPlDataset(context) {
    const { cachedObj: ds } = context;
    const formName = context?.params?.form;
    const datasetId = context?.params?.id;
    const { args = {}, control } = context.req.body;
    // приведение к формату nf
    const _ds = {
        text: ds.text,
        attributes: {
            endpoint: `pl-dataset/${formName}/${datasetId}`
        },
        serverAttributes: {}
    };
    if (ds.provider) _ds.attributes.provider = ds.provider;
    if (ds.serverArgs) _ds.serverAttributes.args = ds.serverArgs;
    return handleEndpoint(context, _ds, args, control);
}

export {
    endpointNfDataset,
    endpointPlDataset,
};
