import { SessionAPI } from './session-api.js';
import { dataProviders } from '../index.js';
import { compileText } from '../src/compiler.js';

/**
 * Возвращает экземпляр провайдера данных.
 *
 * @param {string|NFProvider} provider Провайдер данных, по умолчанию `default`
 * @returns {NFProvider|boolean}
 */
function getProvider(provider = 'default') {
    let ret;
    if (typeof provider === 'string') {
        ret = dataProviders[provider];
    } else {
        ret = provider;
    }
    return ret;
}

/**
 * Класс-обертка для удобной работы с API провайдера.
 *
 * @example
 *     let connect;
 *
 *     try {
 *         connect = await Connect.create();
 *         await connect.begin();
 *         await connect.query(
 *             'insert into nfc.modulelist (code, caption) values (:code, :caption);',
 *             { code: 'Module1',  caption: 'Module 1 name' },
 *         );
 *         await connect.commit();
 *     } catch (e) {
 *         await connect.rollback();
 *         throw e;
 *     } finally {
 *         connect.release();
 *     }
 */
class Connect {
    /**
     * Контекст соединения
     * @type {ExecContext|RequestContext}
     * @private
     */
    _context;

    /**
     * Экземпляр провайдера данных
     * @type {NFProvider}
     * @private
     */
    _provider;

    /**
     * Параметры пользователя соединения с источником данных
     * @type {ProviderCredentials}
     * @private
     */
    _credentials;

    /**
     * Экземлляр соединение с источником данных провайдера
     * @type {*}
     * @private
     */
    _connect;

    /**
     * Возвращает экземпляр соединения с провайдером данных.
     *
     * @param {ExecContext|RequestContext|ProviderCredentials} context контекст соединения или credentials
     * @param {Object} options дополнительные настройки для соединения
     * @param {string|NFProvider} [options.provider] провайдер данных, по умолчанию `default`
     * @param {boolean} [options.forceCredentials] признак, что нужно получить соединение с бд под указанным пользователем, невзирая на настройки провайдера
     * @param {string} [options.connectPlace] шаблон для формирования строки, определяющей место в коде приложения вызова соединения. Например '{applicationName} : importReg'
     * @returns {Promise<Connect>}
     */
    static async create(context, options) {
        const provider = options?.provider ?? 'default';
        const connect = new Connect(context, provider);
        await connect.connect(options);
        return connect;
    }

    /**
     * @use Connect.create();
     * @param {ExecContext|RequestContext|ProviderCredentials} context контекст соединения или credentials
     * @param {string|NFProvider} [provider] провайдер данных, по умолчанию `default`
     */
    constructor(context, provider) {
        this._context = context;
        this._provider = getProvider(provider);
        if (this._context.session instanceof SessionAPI) {
            this._credentials = this._context.session.getCredentials(this._provider);
        } else {
            this._credentials = context;
        }
    }

    /**
     * Соединиться с провайдером данных.
     * @param {Object} options дополнительные настройки для соединения
     * @param {boolean} [options.forceCredentials] признак, что нужно получить соединение с бд под указанным пользователем, невзирая на настройки провайдера
     * @param {string} [options.connectPlace] шаблон для формирования строки, определяющей место в коде приложения вызова соединения. Например '{applicationName} : importReg'
     * @returns {Promise<void>}
     */
    async connect(options) {
        if (this._connect) {
            await this.release();
        }
        this._connect = await this._provider.getConnect(this._credentials, options);
        if (this._context.session instanceof SessionAPI) {
            await this._provider.setContext(
                this._connect, this._context.session.prepareProviderContext(this._provider),
            );
        }
    }

    /**
     * Производит выставление сессионных переменных
     *
     * @param {Array<Object>} context массив объектов {name: ,value: ,namespace: } для сессионных переменных
     * @returns {Promise<*>}
     */
    async context(context = []) {
        return this._provider.setContext(this._connect, context);
    }

    /**
     * Начать транзакцию.
     *
     * @returns {Promise<*>}
     */
    async begin() {
        await this._provider.startTransaction(this._connect);
    }

    /**
     * Выполняет запрос к базе (провайдеру) данных.
     *
     * @example
     *    const connect = await getConnect();
     *    await connect.query(
     *        'select :param::text as field, now()',
     *        { param: 'Hello' },
     *    );
     *
     * @param {string} queryString запрос
     * @param {Object} params параметры
     * @param {ProviderQueryOptions} options настройки формирования отдаваемых данных и прочее, что не касается самого текста запроса
     * @param {ProviderQueryControl} control настройки для преобразования запроса до готового к выполнению состоянию
     * @returns {Promise<ProviderQueryResult>}
     */
    async query(queryString, params = {}, options = {}, control = {}) {
        const _options = { rowMode: 'object', ...options };
        const _queryString = await compileText(queryString, params);
        return this._provider.query(this._connect, _queryString, params, _options, control);
    }

    /**
     * Выполняет запрос к базе (провайдеру) данных через брокер.
     *
     * @example
     *    const connect = await getConnect();
     *    await connect.broker(
     *        'nfc.modulelist.add',
     *        { code: 'Module',  caption: 'Module name' },
     *    );
     *
     * @param {string} action действие. Например, для СУБД в виде Схема.Таблица.Действие или имя функции
     * @param {Object} params параметры
     * @returns {Promise<*>}
     */
    async broker(action, params = {}) {
        if (!this._provider.broker) throw new Error('Broker not found');
        return this._provider.broker(this._connect, action, params);
    }

    /**
     * Выполняет запрос к базе (провайдеру) данных через функцию.
     *
     * @example
     *    const connect = await getConnect();
     *    await connect.func(
     *        'nfc.f4modulelist8add',
     *        { code: 'Module',  caption: 'Module name' },
     *    );
     *
     * @param {string} f имя функции
     * @param {Object} [params] параметры
     *
     * @returns {Promise<*>}
     */
    async func(f, params = {}) {
        return this._provider.func(this._connect, f, params);
    }

    /**
     * Завершить транзакцию.
     *
     * @returns {Promise<*>}
     */
    async commit() {
        return this._provider.commit(this._connect);
    }

    /**
     * Откатить транзакцию.
     *
     * @returns {Promise<*>}
     */
    async rollback() {
        return this._provider.rollback(this._connect);
    }

    /**
     * Завершить соединение с провайдером данных.
     * @returns {Promise<void>}
     */
    async release() {
        if (this._connect) {
            return this._provider.releaseConnect(this._connect);
        }
        return Promise.resolve();
    }
}

/**
 * Возвращает экземпляр соединения с провайдером данных.
 *
 * @example
 *     let connect;
 *     try {
 *         connect = await getConnect();
 *         await connect.begin();
 *         await connect.query(
 *             'insert into nfc.modulelist (code, caption) values (:code, :caption);',
 *             { code: 'Module1',  caption: 'Module 1 name' },
 *         );
 *         await connect.query(
 *             'insert into nfc.modulelist (code, caption) values (:code, :caption);',
 *             { code: 'Module2',  caption: 'Module 2 name' },
 *         );
 *         await connect.commit();
 *     } catch (e) {
 *         await connect.rollback();
 *         throw e;
 *     } finally {
 *         connect.release();
 *     }
 * @param {ExecContext|RequestContext|ProviderCredentials} context контекст соединения или credentials
 * @param {Object} [options] дополнительные настройки для соединения
 * @param {string|NFProvider} [options.provider] провайдер данных, по умолчанию `default`
 * @param {boolean} [options.forceCredentials] признак, что нужно получить соединение с бд под указанным пользователем, невзирая на настройки провайдера
 * @param {string} [options.connectPlace] шаблон для формирования строки, определяющей место в коде приложения вызова соединения. Например '{applicationName} : importReg'
 * @returns {Promise<Connect>}
 */
async function getConnect(context, options= {}) {
    return Connect.create(context, options);
}

/**
 * @typedef {ProviderQueryOptions} BackApiProviderQueryOptions
 * @property {string|NFProvider} [provider] провайдер данных, по умолчанию `default`
 * @property {ExecContext|RequestContext|ProviderCredentials} context контекст соединения или credentials
 * @property {boolean} [forceCredentials] признак, что нужно получить соединение с бд под указанным пользователем, невзирая на настройки провайдера
 * @property {string} [connectPlace] шаблон для формирования строки, определяющей место в коде приложения вызова соединения. Например '{applicationName} : importReg'
 */

/**
 * Выполняет одиночный запрос к базе (провайдеру) данных.
 *
 * @example
 *    await query(
 *        'select :param::text as field, now()',
 *        { param: 'Hello' },
 *    );
 *
 * @param {string|Array<string>} queryString запрос
 * @param {Object} [params] параметры
 * @param {BackApiProviderQueryOptions} options настройки формирования отдаваемых данных и прочее, что не касается самого текста запроса
 * @param {ProviderQueryControl} [control] настройки для преобразования запроса до готового к выполнению состоянию
 * @returns {Promise<ProviderQueryResult>}
 */
async function query(queryString, params = {}, options = {}, control = {}) {
    let result;
    let connect;
    const _options = { provider: 'default', rowMode: 'object', forceCredentials: false, ...options };
    const { context, provider, forceCredentials, connectPlace, ...queryOptions } = _options;
    try {
        connect = await getConnect(context, { provider, forceCredentials, connectPlace });
        await connect.begin();
        if (Array.isArray(queryString)) {
            result = [];
            for (let i = 0, c = queryString.length; i < c; i++) {
                const _queryString = await compileText(queryString[i], params);
                result.push(await connect.query(_queryString, params, queryOptions, control));
            }
        } else {
            const _queryString = await compileText(queryString, params);
            result = await connect.query(_queryString, params, queryOptions, control);
        }
        await connect.commit();
    } catch (e) {
        if(connect) {
            await connect.rollback();
        }
        throw e;
    } finally {
        if (connect) {
            connect.release();
        }
    }
    return result;
}

/**
 * Выполняет одиночный запрос к базе (провайдеру) данных через брокер.
 *
 * @example
 *    await broker(
 *        'nfc.modulelist.add',
 *        { code: 'Module',  caption: 'Module name' },
 *    );
 *
 * @param {string|Array<string>} action действие. Например, для СУБД в виде Схема.Таблица.Действие или имя функции
 * @param {Object} [params] параметры
 * @param {BackApiProviderQueryOptions} options
 * @returns {Promise<*>}
 */
async function broker(action, params = {}, options) {
    let result;
    let connect;
    const _options = { provider: 'default', rowMode: 'object', forceCredentials: false, ...options };
    const { context, provider, forceCredentials, connectPlace } = _options;
    try {
        connect = await getConnect(context, { provider, forceCredentials, connectPlace });
        await connect.begin();
        if (Array.isArray(action)) {
            result = [];
            for (let i = 0, c = action.length; i < c; i++) {
                result.push(await connect.broker(action[i], params));
            }
        } else {
            result = await connect.broker(action, params);
        }
        await connect.commit();
    } catch (e) {
        await connect.rollback();
        throw e;
    } finally {
        if (connect) {
            connect.release();
        }
    }
    return result;
}

/**
 * Выполняет одиночный запрос к базе (провайдеру) данных через функцию.
 *
 * @example
 *    await broker(
 *        'nfc.f4modulelist8add',
 *        { code: 'Module',  caption: 'Module name' },
 *    );
 *
 * @param {string|Array<string>} f имя функции
 * @param {Object} [params] параметры
 * @param {BackApiProviderQueryOptions} options
 * @returns {Promise<*>}
 */
async function func(f, params = {}, options) {
    let result;
    let connect;
    const _options = { provider: 'default', rowMode: 'object', forceCredentials: false, ...options };
    const { context, provider, forceCredentials, connectPlace } = _options;
    try {
        connect = await getConnect(context, { provider, forceCredentials, connectPlace });
        await connect.begin();
        if (Array.isArray(f)) {
            result = [];
            for (let i = 0, c = f.length; i < c; i++) {
                result.push(await connect.func(f[i], params));
            }
        } else {
            result = await connect.func(f, params);
        }
        await connect.commit();
    } catch (e) {
        await connect.rollback();
        throw e;
    } finally {
        if (connect) {
            connect.release();
        }
    }
    return result;
}

export {
    getProvider,
    Connect,
    getConnect,
    query,
    broker,
    func,
};
