import { VM } from 'vm2';
import url from 'url';
import { config, api, debug, common, container, extension } from '@nfjs/core';
import { compileText } from './compiler.js';
import { dataProviders} from '../index.js';
import { composeServerArgs } from './compose-server-args.js';


const debugIncludeToResponse = common.getPath(config, 'debug.includeToResponse') || false;
let { loggerDataEndpoints, appNameActionDataset } = config?.['@nfjs/back'] || {};
if (appNameActionDataset === 'default') appNameActionDataset = '{applicationName}[{instanceName}]:form[{form}]:id[{id}]';

/**
 * Атрибуты действия
 * @typedef {Object} NfActionAttributes
 * @property {string} action выполняемое действие (имя функции или действия над разделом)
 * @property {boolean} broker флаг, что нужно выполнять через метод broker провайдера данных
 * @property {string} provider имя провайдера данных, в котором нужно выполнять
 * @property {string} out перечень свойств данных результата выполнения, которые нужно внести в общие аргументы выполнения
 */

/**
 * Серверные атрибуты действия
 * @typedef {Object} NfActionServerAttributes
 * @property {string} args строка, по которой в аргументы выполнения добавятся значения из сессии пользователя
 */

/**
 * Атрибуты суб-действия
 * @typedef {Object} NfActionOnAttributes
 * @property {string} action выполняемое действие (имя функции или действия над разделом)
 * @property {boolean} broker флаг, что нужно выполнять через метод broker провайдера данных
 * @property {string} path путь обрабатываемого элемента в общих аргументах действия
 * @property {string} filter перечень модификаторов с данными элемента, отбирающий только нужны элементы для срабатывания действия add,upd,del,each
 * @property {string} args строка, по которой сформируются аргументы выполнения из общих аргументов действия и данных обрабатываемого элемента "_compose('pid;...',/id,*)"
 * @property {number} order порядок выполнения действия, когда на один путь и по одному модификатору есть несколько действий
 * @property {string} out перечень свойств данных результата выполнения, которые нужно внести в общие аргументы выполнения
 */

/**
 * Суб-действие - для обработки элементов массива в общем аргументе
 * @typedef {Object} NfActionOn
 * @property {NfActionOnAttributes} attributes атрибуты
 * @property {string} text действие в виде текста на языке указанного провайдера
 */

/**
 * Действие
 * @typedef {Object} NfAction
 * @property {NfActionAttributes} attributes атрибуты
 * @property {NfActionServerAttributes} serverAttributes серверные атрибуты
 * @property {NfActionOn[]} on перечень суб-действий
 * @property {string} text действие в виде текста на языке указанного провайдера
 */

/**
 * Вызов выполнения всех подходящих action-on для обрабатываемого элемента и рекурсирвно вглубь свойств-массивов
 * @param {Array<NFProvider>} providers массив соединений с провайдерами данных
 * @param {Object} args входные аргументы
 * @param {Array<NfActionOn>} ons свойства всех action-on обрабатываемого action
 * @param {string} deepPath обрабатываемое свойство-массив
 * @param {Object} inlineObj объект, повторяющий структуру изначальных входных данных корневого действия с заменой
 *  свойств-массивов на текущий обрабатываемый элемент массива для возможности получения данных верхних уровней для
 *  текущего вложенного действия
 * @param {SessionAPI} session сессия пользователя
 * @param {string} indexDeepPath путь к обрабатываемому элементу массива в изначальном объекте аргументов выполнения
 * @returns {Promise<Object>}
 */
async function actionOns(providers, args, ons, deepPath, inlineObj, session, indexDeepPath) {
    let arrProccess;
    let isObject = false;
    if (deepPath == '') {
        arrProccess = [args];
    } else {
        arrProccess = common.getPath(args, indexDeepPath);
        if (!Array.isArray(arrProccess)) {
            if (arrProccess && typeof arrProccess === 'object') {
                isObject = true;
                arrProccess = [arrProccess];
            } else return;
        } else if (arrProccess.length === 0) return;
    }

    const paths = [];

    const actsOnForPath = [];
    // выясняем какие следующие пути для обработки
    for (let o = 0; o < ons.length; o++) {
        const onPath = ons[o].attributes.path;
        const nP = onPath && onPath.replace(deepPath ? new RegExp(`^${deepPath}\.?`) : '', '');
        if (nP && onPath.indexOf(deepPath) === 0 && nP.indexOf('.') === -1 && !paths.find((p) => p.full == onPath)) {
            paths.push({ full: onPath, last: nP }); // Следующий уровень
        }
        if (onPath === deepPath || (onPath === undefined && deepPath === '')) {
            actsOnForPath.push(ons[o]);
        }
    }

    const resObj = {};
    for (let a = 0; a < arrProccess.length; a++) {
        const action = arrProccess[a].$action;
        if (deepPath) {
            common.setPath(inlineObj, deepPath, arrProccess[a]);
        }
        // Для текущего объекта обрабатываем все экшены
        for (let o = 0; o < actsOnForPath.length; o++) {
            const onFilter = actsOnForPath[o].attributes.filter.split(';');

            if (onFilter.indexOf('each') !== -1 || onFilter.indexOf(action) !== -1) {
                const onId = `#${a}#${actsOnForPath[o].attributes.id || actsOnForPath[o].attributes.action}:${action || 'each'}`;
                resObj[onId] = resObj[onId] || [];
                resObj[onId].push(await processAction(true, providers, actsOnForPath[o], arrProccess[a], inlineObj, session));
            }
        }
        // Внутрь
        for (let p = 0; p < paths.length; p++) {
            resObj._childs = resObj._childs || {};
            resObj._childs[`${paths[p].full}#${a}`] = await actionOns(providers, args, ons, paths[p].full, inlineObj, session, deepPath ? `${indexDeepPath}${isObject ? '' : (`.${a}`)}.${paths[p].last}` : paths[p].full);
        }
    }
    return resObj;
}

/**
 * Выполнение единичного действия с подстановкой результата во входные данные
 * @param {boolean} isActionOn метка, что действие является вложенным
 * @param {Array<NFProvider>} providers массив соединений с провайдерами данных
 * @param {NfAction|NfActionOn} action свойства выполняемого действия
 * @param {Object} args входные аргументы
 * @param {Object} inlineObj объект, повторяющий структуру изначальных входных данных корневого действия с заменой
 *  свойств-массивов на текущий обрабатываемый элемент массива для возможности получения данных верхних уровней для
 *  текущего вложенного действия
 * @param {SessionAPI} session сессия пользователя
 * @returns {Promise<{data: Object, debug: Object}>}
 */
async function processAction(isActionOn, providers, action, args, inlineObj, session) {
    let queryText = null;
    let queryArgs = null;
    let queryType = null;
    const { attributes } = action;
    // $$action в args передается когда action - вычисляемый на клиенте
    if (args.$$action !== undefined) {
        attributes.action = args.$$action;
        delete args.$$action;
    }
    // для самого action compose аргументов был сделан уже, для action-on делается здесь
    if (isActionOn && attributes && attributes.args && attributes.args.indexOf('_compose') !== -1) {
        const scriptArgs = attributes.args.replace(/\//g, '__root.').replace(/\*/g, '__data').replace(/@@/g, '').replace(/@/g, '__sess.');
        const scriptCtx = {
            __args: {}, // выходные данные
            __data: args, // данные текущего обрабатываемого узла данных
            __sess: { ...session.get('context') }, // объект сессионных значений
            _compose: common.compose,
        };
        Object.assign(scriptCtx, args);
        Object.assign(scriptCtx, { __root: inlineObj });
        const vm = new VM({
            sandbox: scriptCtx,
        });
        try {
            queryArgs = vm.run(scriptArgs);
        } catch (e) {
            const _msg = `Ошибка вычисления аргументов действия [${attributes.action}] для пути [${attributes.path}] с фильтром [${attributes.filter}]`;
            throw api.nfError(e, _msg);
        }
    } else {
        queryArgs = { ...args };
    }
    // изначально сделано для js действий в auth
    if (attributes.provider && attributes.provider === 'js') {
        queryArgs.__session = session;
    }
    // определить тип вызова провайдера
    if ('broker' in attributes) {
        queryType = 'broker';
        queryText = attributes.action.trim();
        if (!queryText) queryType = false;
    } else if (attributes.action) {
        queryType = 'func';
        queryText = attributes.action.trim();
        if (!queryText) queryType = false;
    } else if (action.text) {
        queryType = 'query';
        queryText = action.text.trim();
        queryArgs && (queryArgs.__context = session.get('context'));
        queryText = await compileText(queryText, queryArgs);
        queryArgs && (delete queryArgs.__context);
    }
    let queryResult;
    if (queryType) { // действие не пустышка
        const provider = providers.find((curPrv) => curPrv.name === ((attributes.provider) ? attributes.provider : 'default'));
        const opts = {
            rowMode: 'object',
            method: attributes.method
        };
        queryResult = await provider.api[queryType](provider.connect, queryText, queryArgs, opts, null);
        if (queryResult.data instanceof Array && queryResult.data.length > 0) {
            queryResult.data = queryResult.data.shift();
        }
        // вставить результат в исходный объект с данными args
        if (attributes.out && queryResult.data) {
            if (attributes.out === '...') {
                Object.assign(args, queryResult.data);
            } else {
                attributes.out.split(';').forEach((currOutItem) => {
                    const targetProp = currOutItem.split(':')[0];
                    let outProp = currOutItem.split(':')[1] || currOutItem.split(':')[0];
                    [outProp] = outProp.split('|');
                    if (outProp in queryResult.data) {
                        common.setPath(args, targetProp, queryResult.data[outProp]);
                    }
                });
            }
        }
    }
    return queryResult || { data: [], debug: {} };
}

/**
 * @typedef NfExecuteActionResult
 * @property {Object} [data] выходные данные при удачном выполнении (если результатом был набор данных, то берется первый лемент)
 * @property {Object|string} [error] информация об ошибке, если выполнение неудачно
 * @property {Object} [debug] отладочная информация
 */

/**
 * Выполнение действия
 * @param {NfAction} action действие
 * @param {Object} args входные аргументы
 * @param {SessionAPI} session сессия пользователя
 * @param {Object} options опции
 * @param {string} options.connectPlace указание для провайдера данных, откуда производится действие
 * @returns {Promise<NfExecuteActionResult>}
 */
async function executeAction(action, args, session, options) {
    const tmng = {};
    debug.timingStart(tmng, 'all');
    const { attributes: actAttrs, on: actOn } = action;
    const { out: actOut } = actAttrs;
    const actArgs = common.cloneDeep(args);
    // дополнить аргументы необходимыми из сессии пользователя
    if (action?.serverAttributes?.args) Object.assign(actArgs, composeServerArgs(session, action?.serverAttributes?.args));
    // используются ли вложенные действия
    const useActionsOn = (actOn && Array.isArray(actOn) && actOn.length > 0);
    // провайдер основного действия
    const providerName = actAttrs?.provider ?? 'default';
    const providers = [{ name: providerName, api: dataProviders[providerName] }];
    if (useActionsOn) {
        // сортировка очереди выполнения action-on
        actOn.sort((a, b) => {
            a.attributes.order = +a.attributes.order || 0;
            b.attributes.order = +b.attributes.order || 0;
            return a.attributes.order - b.attributes.order;
        });
        // все используемые провайдеры в action-on
        actOn.forEach((curActOn) => {
            const _providerName = (curActOn.attributes && curActOn.attributes.provider) ? curActOn.attributes.provider : 'default';
            if (providers.findIndex(p => p.name === _providerName) === -1) {
                providers.push({ name: _providerName, api: dataProviders[_providerName] });
            }
        });
    }
    try {
        providers.forEach((provider) => {
            provider.credentials = session.getCredentials(provider.api);
            provider.dbContext = session.prepareProviderContext(provider.api);
        });
        debug.timingStart(tmng, 'connect');
        // соединение со всеми используемыми провайдерами
        const connects = await Promise.all(providers.map((curPrv) => curPrv.api.getConnect(curPrv.credentials, {connectPlace: options.connectPlace})));
        connects.forEach((connect, indx) => { providers[indx].connect = connect;});
        debug.timingEnd(tmng, 'connect');
        debug.timingStart(tmng, 'context');
        // выставить сессионные переменные в источниках данных
        await Promise.all(providers.map((curPrv) => curPrv.api.setContext(curPrv.connect, curPrv.dbContext)));
        debug.timingEnd(tmng, 'context');

        const argObj = { ...actArgs };

        debug.timingStart(tmng, 'transactStart');
        // начать транзакции во всех источниках данных
        await Promise.all(providers.map((curPrv) => curPrv.api.startTransaction(curPrv.connect)));
        debug.timingEnd(tmng, 'transactStart');
        debug.timingStart(tmng, 'execute');

        // выполнение основного действия
        const queryResult = await processAction(false, providers, action, argObj, null, session);
        queryResult.data = { ...queryResult.data };

        // запуск рекурсивного выполнения action-on
        if (useActionsOn) {
            const inlineObj = common.cloneDeep(argObj);
            queryResult._childs = await actionOns(providers, argObj, actOn, '', inlineObj, session, '');
        }

        debug.timingEnd(tmng, 'execute');
        debug.timingStart(tmng, 'commit');
        await Promise.all(providers.map((curPrv) => curPrv.api.commit(curPrv.connect)));
        debug.timingEnd(tmng, 'commit');
        debug.timingEnd(tmng, 'all');
        if (queryResult.debug) {
            if (debugIncludeToResponse) {
                const { timing } = queryResult.debug;
                if (timing) {
                    timing.back = tmng;
                } else {
                    queryResult.debug.timing = { back: tmng };
                }
            } else {
                delete queryResult.debug;
            }
        }
        return queryResult;
    } catch (e) {
        await Promise.all(providers.map((curPrv) => (curPrv.connect ? curPrv.api.rollback(curPrv.connect) : Promise.resolve())));
        // попросить каждый из провайдеров обработать ошибку, если какой-то из провайдеров вернет сообщение,
        // отличающееся от сообщения из ошибки - считаем ошибку обработанной
        const { message } = e;
        let msg;
        for (let i = 0; i < providers.length; i++) {
            if (providers[i].api.formatError) {
                const _msg = await providers[i].api.formatError(e);
                if (_msg !== message) {
                    msg = _msg;
                    break;
                }
            }
        }
        const err = api.nfError(e, msg);
        let errorResponse;
        if (debugIncludeToResponse) {
            errorResponse = err.json();
        } else {
            errorResponse = { error: err.message };
        }
        return errorResponse;
    } finally {
        providers.forEach((curPrv) => { curPrv.api.releaseConnect(curPrv.connect);});
    }
}

/**
 * Выполнение действия с логгированием
 * @param {NfAction} action действие
 * @param {Object} args входные аргументы
 * @param {SessionAPI} session сессия пользователя
 * @param {Object} [options] опции
 * @param {string} options.connectPlace указание для провайдера данных, откуда производится действие
 * @returns {Promise<NfExecuteActionResult>}
 */
async function handleEndpoint(action, args, session, options) {
    const result = await executeAction(action, args, session, { connectPlace: options && options.connectPlace });
    // записать в журнал запросов за данными
    if (loggerDataEndpoints && container.loggers) {
        const { password, ...session_context } = session?.session?.context;
        const ip = (context.req.headers['x-forwarded-for'] || context.req?.connection?.remoteAddress || '').split(',')[0].trim();
        const args = (action?.attributes?.action) ? { id: args.id, other: 'hidden' } : args;
        const logger = container.loggers.get(loggerDataEndpoints);
        const log = {
            logType: 'action',
            endpoint: action?.attributes?.endpoint,
            action: action?.attributes?.action,
            args,
            remoteAddress: ip,
            session_context
        }
        if (result.data) { // успешно выполнилось
            log.resultId = result.data && result.data.id;
        } else {
            log.error = result.error;
        }
        logger.info('', log);
    }
    return result;
}


/**
 * Обработка запроса выполнения действия от компонента nf-action в зависимости
 * от указанного типа источника данных provider
 * Ответ от провайдера ожидается в виде объекта {data:[],debug:{},error:""}
 * (error и data взаимно исключают друг друга)
 * @param {RequestContext} context контекст запроса к серверу
 * @returns {Promise<NfExecuteActionResult>}
 */
async function endpointNfAction(context) {
    const { cachedObj: action, session } = context;
    const args = context.req.body?.args;
    let connectPlace;
    if (!!appNameActionDataset) connectPlace = appNameActionDataset
        .replace(/{form}/g, context?.params?.form)
        .replace(/{id}/g, context?.params?.id);
    return handleEndpoint(action, args, session, { connectPlace });
}

/**
 * Функция для сортировки суб-действий
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
function sortOn(a,b) {
    if (!!a.order && !!b.order) {
        return a.order - b.order;
    } else if (!!a.order) {
        return -1;
    } else if (!!b.order) {
        return 1;
    } else {
        const filterOrder = ['each','del','upd','add'];
        const aI = filterOrder.indexOf(a.filter);
        if (aI === -1) throw new Error(`filter не может принимать значение [${a.filter}]`);
        const bI = filterOrder.indexOf(b.filter);
        if (bI === -1) throw new Error(`filter не может принимать значение [${b.filter}]`);
        return aI - bI;
    }
}

/**
 * Преобразование формата описания PlAction в NfAction
 * @param {Object} from PlAction описание
 * @param {NfAction} to NfAction описание
 * @param {string} [path] для рекурсивного вызова суб-действий
 */
function convertToNfAction(from, to, path = '') {
    if (path === '') {
        to.on = [];
        to.attributes = {};
        const main = from['@main'] ?? {};
        if (main.provider) to.attributes.provider = main.provider;
        if (main.out) to.attributes.out = main.out;
        switch (main.type) {
            case 'query':
                to.text = main.action;
                break;
            case 'func':
                to.attributes.action = main.action;
                to.attributes.broker = false;
                break;
            case 'broker':
                to.attributes.action = main.action;
                to.attributes.broker = true;
                break;
            default:
                break;
        }
        if (main.serverArgs) to.serverAttributes = { args: main.serverArgs };
    }
    const ons = [];
    Object.keys(from).forEach(k => {
        if (k.charAt(0) === '@') {
            // для всех уровней в объекте, кроме нулевого
            k.substr(1).split(';').filter(f => path !== '').forEach(filter => {
                const acts = (Array.isArray(from[k]) ? from[k] : [from[k]]);
                acts.forEach(act => {
                    const attributes = {
                        path,
                        filter
                    };
                    const on = { attributes };
                    if (act.provider) attributes.provider = act.provider;
                    if (act.order) attributes.order = act.order;
                    if (act.out) attributes.out = act.out;
                    switch (act.type) {
                        case 'query':
                            on.text = act.action;
                            break;
                        case 'func':
                            attributes.action = act.action;
                            attributes.broker = false;
                            break;
                        case 'broker':
                            attributes.action = act.action;
                            attributes.broker = true;
                            break;
                        default:
                            break;
                    }
                    if (act.args) {
                        // args: {pid: '**.id', '...': '*'},
                        const prfx = Object.keys(act.args).join(';');
                        const sfx = Object.values(act.args).join(',');
                        attributes.args = `_compose('${prfx}',${sfx})`;
                    }
                    ons.push(on);
                });
            });
            // выставление order
            ons.sort((a,b) => sortOn(a.attributes, b.attributes)).forEach((item, idx) => {
                item.attributes.order = idx;
            });
        } else { // вложенный уровень данных
            convertToNfAction(from[k], to, (path === '') ? k : `${path}.${k}`);
        }
    });
    to.on.push(...ons);
}

/**
 * Обработка запроса выполнения действия от компонента pl-action в зависимости
 * от указанного типа источника данных provider
 * Ответ от провайдера ожидается в виде объекта {data:[],debug:{},error:""}
 * (error и data взаимно исключают друг друга)
 * @param {RequestContext} context контекст запроса к серверу
 * @returns {Promise<NfExecuteActionResult>}
 */
async function endpointPlAction(context) {
    const { cachedObj: action, session } = context;
    const formName = context?.params?.form;
    const actionId = context?.params?.id;
    const { args } = context.req.body;
    let connectPlace;
    if (!!appNameActionDataset) connectPlace = appNameActionDataset
        .replace(/{form}/g, formName)
        .replace(/{id}/g, actionId);
    // приведение к формату
    const _action = {};
    convertToNfAction(action, _action);
    common.setPath(_action, 'attributes.endpoint', `pl-action/${formName}/${actionId}`);
    return handleEndpoint(_action, args, session, { connectPlace });
}

/**
 * Обработка запроса выполнения действия, который расположе в подпапках endpoint/action подключенных модулей
 * @param {RequestContext} context - контекст запроса к серверу
 * @returns {Promise<NfExecuteActionResult>}
 */
async function endpointAction(context) {
    const { session } = context;
    const { args } = context.req.body;
    const actionPath = context.params.actionPath;
    // поиск action файла с учетом порядка подключения модулей
    const file = await extension.getFiles('endpoint/action/' + actionPath.replace(/\./g, '/') + '.js');
    if (!file) throw new Error(`action [${actionPath}] not found.`);
    const urlFile = url.pathToFileURL(file).toString();
    const actFile = await import(urlFile);
    const action = actFile?.default;
    // приведение к формату
    const _action = {};
    convertToNfAction(action, _action);
    common.setPath(_action, 'attributes.endpoint', `endpoint-action/${actionPath}`);
    return handleEndpoint(_action, args, session);
}

export {
    sortOn,
    convertToNfAction,
    endpointNfAction,
    endpointPlAction,
    endpointAction
};
