import { common } from '@nfjs/core';

/**
 * Работа с сессиоными данными пользователя
 */
export class SessionAPI {
    /**
     * @param {Object} session - сессия пользователя на веб сервере
     */
    constructor(session) {
        this.session = session;
    }

    /**
     * Получить значение параметра сессии по пути в объекте
     * @param {string} path - путь - перечень вложенных свойст разделенных "."
     * @return {*}
     */
    get(path) {
        return common.getPath(this.session, path);
    }

    /**
     * Установить значение по пути
     * @param {string} path - путь
     * @param {*} value - значение
     */
    set(path, value) {
        common.setPath(this.session, path, value);
    }

    /**
     * Объединить значение по пути с указанным
     * @param {string} path - путь
     * @param {Object|Array} value - значение
     */
    assign(path, value) {
        if (value instanceof Array) {
            common.setPath(this.session, path, (this.get(path) || []).concat(value));
        } else {
            common.setPath(this.session, path, { ...this.get(path), ...value });
        }
    }

    /**
     * Уничтожить сессию пользователя
     */
    destroy() {
        this.session.destroy();
    }

    /**
     * Получить из сессии данные для запроса соединения с указанным источником данных
     * @param {NFProvider} provider - экземляр провайдера данных
     * @return {ProviderCredentials}
     */
    getCredentials(provider) {
        const providerSetting = common.getPath(provider, 'config.credentialsSource');
        let credentials;
        if (providerSetting === 'session') {
            credentials = {
                user: this.get('context.user'),
                password: this.get('context.password'),
            };
        } else {
            credentials = provider.getConfigCredentials();
        }
        return credentials;
    }

    /**
     * Получить из сессии данных для установки сессионных переменных в соединение с источником данных
     * @param {NFProvider} provider - экземляр провайдера данных
     * @return {Array<{name: string, value: *, [namespace]: string}>}
     */
    prepareProviderContext(provider) {
        const prvCtx = this.get('context.prv');
        const preparedCtx = [];
        if (Array.isArray(prvCtx) && prvCtx.length > 0) {
            prvCtx.forEach((item) => {
                if (item.prvType === provider.config.type || item.prvType === '' || !item.prvType) {
                    preparedCtx.push({
                        name: item.name,
                        namespace: item.namespace,
                        value: this.get(`context.${item.ctx}`),
                    });
                }
            });
        }
        return preparedCtx;
    }
}

