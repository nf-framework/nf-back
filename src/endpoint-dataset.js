import AbortController from 'node-abort-controller';
import { config, api, debug, common, container } from '@nfjs/core';
import { query } from '../lib/dbapi.js';
import { compileEndpointText } from './compiler.js';
import { composeServerArgs } from './compose-server-args.js';

const debugIncludeToResponse = common.getPath(config, 'debug.includeToResponse') || false;
let { loggerDataEndpoints, appNameActionDataset } = config?.['@nfjs/back'] || {};
if (appNameActionDataset === 'default') appNameActionDataset = '{applicationName}[{instanceName}]:form[{form}]:id[{id}]';

/**
 * Обработка запроса выполнения действия от компонента nf-dataset
 * Ответ от провайдера ожидается в виде объекта {data:[],debug:{},error:""}
 * (error и data взаимно исключают друг друга)
 * Отправляемый объект {data:[],debug:{},error:""}
 * @param {RequestContext} context - контекст запроса к серверу
 */
async function endpointDataset(context) {
    const controller = new AbortController();
    const signal = controller.signal;
    context.req.on('aborted', () => {
        controller.abort();
    });
    const { cachedObj: ds, session } = context;
    let { text, attributes, serverAttributes } = ds;
    const { args = {}, control } = context.req.body;
    const logArgs = { ...args }, logControl = { ...control };
    let resp = {};
    try {
        const serverArgs = composeServerArgs(context.session, serverAttributes?.args);
        if (serverArgs) Object.assign(args, serverArgs);
        text = await compileEndpointText(text, args);

        const provider = (control && control.provider) || attributes.provider || 'default';

        if (provider === 'js') args.__session = session;

        const connectPlace = (!!appNameActionDataset)
            ? appNameActionDataset.replace(/{form}/g, context?.params?.form).replace(/{id}/g, context?.params?.id)
            : undefined;

        resp = await query(text, args,{ ...attributes, signal, provider, context, connectPlace }, control);
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

export {
    endpointDataset,
};
