import { errors } from '@nfjs/core';

/**
 * @typedef {Object} ProviderCredentials
 * @property {string} user пользователь
 * @property {string} password пароль
 */

/**
 * @typedef {Object} ProviderQueryControlFilter
 * @property {string} field наименование поля
 * @property {*} value значение поля
 * @property {string} operator оператор сравнения с полем
 *      Если явно не указан, то проверяется начальные символы value на соотвествие заложенным операторам ~,>,<,=,!,[,],>=,<=,!=,!~,(),!()
 * @property {string} cast дополнительное преобразование поля и значения, например lower. Если в строке есть префикс"left-", то
 *      преобразование относится только к полю, если "right-", то только к значению
 */

/**
 * Настройки над чистым запросом за данными в бд. Применяется для сортировки, фильтрации, постраничного вывода
 * @typedef {Object} ProviderQueryControl
 * @property {'scroll'|'full'|'tree'} [datamode] режим работы:
 *      scroll - подгружаемый список,
 *      full[default] - весь объем данных,
 *      tree - дерево
 * @property {Array<{field: string, sort: string}>} sorts массив сортируемых столбцов, индекс определяет порядок применения сортировок
 *      field - наименование сортируемого поля,
 *      sort - направление сортировки (asc,desc,asc nulls first и прочее).
 * @property {Object} range границы куска получения данных
 * @property {number} range.chunk_start номер строки начала куска данных
 * @property {number} range.chunk_end номер строки конца куска данных
 * @property {number} range.amount количество данных, если явно не указан chunk_end
 * @property {Array<ProviderQueryControlFilter>} filters массив применяемых к запросу фильтров.
 * @property {Object} locate настройка для позиционирования в массиве данных на указанный элемент. Если проиходит позиционирование, то будет отдан кусок данный его содержащий невзирая на range.
 * @property {boolean} locate.locating признак, использовать позиционирование или нет
 * @property {Object} locate.located объект из уже полученных массива данных, который был найден (как бы возвращаемое значение)
 * @property {string} locate.field наименование поля, по которому искать
 * @property {*} locate.value значение поля
 * @property {Object} treeMode настройки для режима отдачи данных для дерева
 * @property {string} treeMode.hidField поле запроса, являющимся ссылкой на основной ключ
 * @property {*} treeMode.hidValue его значение, для отбора данных запрашиваемого узла
 * @property {boolean} treeMode.filterByHid признак, производить ли фильтраци. по узлй или нет
 * @property {Object} treeMode.keyField поле запроса, являющееся основным ключом
 * @property {Object} treeMode.hasChildField поле запроса, в котором вычисляемый признак - есть у данной записи дочерние или нет
 *
 */

/**
 * @typedef {Object} ProviderResultMetaData
 * @property {string} name имя колонки
 * @property {string} dataType тип данных в колонке (соотносимый с примитивами js)
 * @property {string} dataSubType подтип типа данных в колонке (более точный)
 */

/**
 * @typedef {Object} ProviderQueryResult
 * @property {Array<Object|Array>} data возвращаемые данные
 * @property {Array<ProviderResultMetaData>} metaData описание колонок данных
 * @property {boolean} chunk признак, что данные - часть от всех возможных
 * @property {number} [chunk_start] начальный номер данных части в возможных
 * @property {number} [chunk_end] конечный номер данных части в возможных
 * @property {number} [located] (не используется) номер записи в данных, которую искали для выяснения в какой части данных она находилась
 * @property {'array'|'object'} rowMode способ формирования элементов данных в ответе.
 *      array - массив с длинной в количесво отдаваемых колонок
 *      object - объект со свойствами - колоноками ответа
 * @property {Object} debug отладочная информация
 */

/**
 * @typedef {Object} ProviderQueryOptions
 * @property {'array'|'object'} [rowMode] способ формирования элементов данных в ответе.
 *      array - массив с длинной в количесво отдаваемых колонок
 *      object - объект со свойствами - колоноками ответа
 * @property {boolean} [returnRN] возвращать или нет в ответе номера отдаваемых строк
 * @property {AbortSignal} [signal] сигнал, означающий, что данные выполняемого запроса уже никому не нужны
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {Object} connectConfig настройки соединения с источником данных. Формат зависит от типа источника
 * @property {Object} tunnel настройки туннеля для соединения в формате библиотеки tunnel-ssh
 * @property {string} name имя провайдера. Повторяет свойство узла экзмепляра провайдера из конфигурационного файла приложения
 * @property {string} type тип источника данных, по которму потом инстанцируются экземляры в модулях, где они имплементированы (например: db-postgres)
 * @property {string} connectType способ соединения с источником
 *      user - когда кадый запрос на соединение формируется отдельно
 *      pool - когда создается общий пул соединений при первом запросе на соединение под параметрами именного этого запроса
 *      poolPerUser - создаеются пулы соединений под каждого пользователя источника данных, когда под ними было запрошено соединение
 * @property {Object} connectPoolConfig дополнительные настройки пула соединений с источником. Формат от типа источника
 * @property {'session'|'config'} credentialsSource откуда брать параметры пользователяю пароля и т.п. для соединения (или формирования пула)
 *      session - из сессии пользователя вебсервера
 *      config - всегда из connectConfig
 * @property {Object} supportConnectConfig дополнительные настройки для соединения-администрирования. Используется на данный момент
 *      для прерывания ненужных запросов
 */

const notDefinedMethod = 'Метод должен быть переопределен';
const messageList = {
    notDefinedMethod: 'Метод должен быть переопределен',
    parseQueryFailed: 'Разбор запроса к источнику данных не удался',
    executeQueryFailed: 'Выполнение запроса к источнику данных прошло с ошибкой',
    executeFuncFailed: 'Выполнение функции в источнике данных прошло с ошибкой',
    configConnectTypeCredentialsSourceMismatch: 'Настройка провайдера данных connectType = pool и credentialsSource = session не допустимо',
    notAllParamsPassed: 'Не были переданы параметры для выполнения',
};

/**
 * Класс-родитель для имплементации конкретных источников данных
 */
export class NFProvider {
    /**
     * @param {ProviderConfig} config параметры провайдера
     */
    constructor(config) {
        this.config = config;
        this.name = config?.name;
        this.onConnectQueries = [];
        this.onConnectConfig = config?.connectConfig?.sessionConfig || [];
        // поднятие shh туннеля при наличии в конфиге провайдера
        const { tunnel: tunnelConfig } = config;
        if (tunnelConfig && tunnelConfig.host) {
            // eslint-disable-next-line global-require
            const sshTunnel = require('tunnel-ssh');
            tunnelConfig.keepAlive = true;
            const srv = sshTunnel(tunnelConfig, (err, server) => {
                if (err) {
                    throw new errors.NFError(err, `Ошибка при создании ssh-туннеля провайдера ${this.name}:`);
                }
            });
            srv.on('error', (err) => {
                // TODO корректно сообщить клиенту. Если не поглощать ошибку сервер ноды останавливается.
                console.log(err);
            });
        }
        this.pools = {};
    }

    /**
     * Настройки пользователя в источнике данных из конфига
     * @return {ProviderCredentials}
     */
    getConfigCredentials() {
        return {
            user: this.config.connectConfig.user,
            password: this.config.connectConfig.password,
        };
    }

    /**
     * Возвращает экземпляр соединения с провайдером данных.
     *
     * @param {ProviderCredentials} credentials данные для соединения (пользователь, пароль или контекст выполнения)
     * @param {Object} options дополнительные настройки для соединения
     * @param {boolean} [options.forceCredentials] признак, что нужно получить соединение с бд под указанным пользователем, невзирая на настройки провайдера
     * @param {string} [options.connectPlace] шаблон для формирования строки, определяющей место в коде приложения вызова соединения. Например '{applicationName} : importReg'
     * @returns {Promise<*>}
     */
    getConnect(credentials, options) {
        const { connectType, credentialsSource } = this.config;
        if (connectType === 'pool' && credentialsSource === 'session') {
            throw new Error(messageList.configConnectTypeCredentialsSourceMismatch);
        }
        return Promise.resolve();
    }

    /**
     * Производит выставление сессионных переменных в соединение с источником данных
     *
     * @param {*} connect соединение с источником данных
     * @param {Array<{name: string, value: *, [namespace]: string}>} context массив объектов {name: ,value: ,namespace: } для сессионных переменных
     * @returns {Promise<*>}
     */
    async setContext(connect, context) {
        return Promise.resolve();
    }

    /**
     * Выполнение запроса за данными в источнике данных
     *
     * @param {*} connect соединение с источником данных
     * @param {string} query запрос
     * @param {Object} params параметры
     * @param {ProviderQueryOptions} options настройки формирования отдаваемых данных и прочее, что не касается самого текста запроса
     * @param {ProviderQueryControl} control настройки для преобразования запроса до готового к выполнению состоянию
     * @returns {Promise<ProviderQueryResult>}
     */
    async query(connect, query, params, options, control) {
        throw new Error(notDefinedMethod);
    }

    /**
     * Выполняет одиночный запрос к базе (провайдеру) данных через функцию.
     *
     * @example
     *    await broker(
     *        'nfc.f4modulelist8add',
     *        { code: 'Module',  caption: 'Module name' },
     *    );
     * @param {*} connect соединение с источником данных
     * @param {string} func имя функции
     * @param {Object} [params] параметры
     * @returns {Promise<*>}
     */
    async func(connect, func, params) {
        throw new Error(notDefinedMethod);
    }

    /**
     * Выполняет запрос к источнику данных через брокер (чаще всего - динамическое формирование CrUD запросов).
     *
     * @param {*} connect соединение с источником данных
     * @param {string} action действие. Например, для СУБД в виде Схема.Таблица.Действие или имя функции
     * @param {Object} params параметры
     * @returns {Promise<*>}
     */
    async broker(connect, action, params) {
        throw new Error(notDefinedMethod);
    }

    /**
     * Начать транзакцию
     *
     * @param {*} connect соединение с источником данных
     * @return {Promise<*>}
     */
    async startTransaction(connect) {
        return Promise.resolve();
    }

    /**
     * Подтвердить транзакцию
     *
     * @param {*} connect соединение с источником данных
     * @return {Promise<*>}
     */
    async commit(connect) {
        return Promise.resolve();
    }

    /**
     * Отменить транзакцию
     *
     * @param {*} connect соединение с источником данных
     * @return {Promise<*>}
     */
    async rollback(connect) {
        return Promise.resolve();
    }

    /**
     * Завершить соединение
     *
     * @param {*} connect соединение с источником данных
     * @return {Promise<*>}
     */
    releaseConnect(connect) {
        return Promise.resolve();
    }

    /**
     * Вернуть расшифровку предопределенного сообщения по его коду
     *
     * @param {string} messageCode код предопределенного сообщения из messageList
     * @return {string}
     */
    static getMsg(messageCode) {
        return messageList[messageCode];
    }

    /**
     * Формирование текста запроса в источник данных для получения списка всплывающих подсказок при написании кода в компонентах платформы
     * в интерфейсах разработки
     *
     * @param {string} component компонент платформы, для которого нужна всплывающая подсказка (например action, dataset)
     * @param {string} prefix уже набранный текст, к которому идет подсказка
     * @param {Object} options дополнительные настройки для формирований подсказки в зависимости от компонента
     * @return {Promise<string>}
     */
    static getMetaCompletingStatement(component, prefix, options) {
        throw new Error(notDefinedMethod);
    }

    /**
     * Преобразование запроса в источник данных из вида как он написан в компонентах платформы в вид принимаемый источником данных
     *
     * @param {{query: string, params: Object}} source как в платформе
     * @param {{query: string, params: Array|Object}} target как в источнике данных
     */
    static formatQuery(source, target) {
        throw new Error(notDefinedMethod);
    }

    /**
     * Приведение ошибки полученной из источника данных в человекочитаемое сообщение
     *
     * @param {*} e пойманное исключение
     * @return {Promise<string>}
     */
    static async formatError(e) {
        const { message } = e;
        return Promise.resolve(message);
    }
}
