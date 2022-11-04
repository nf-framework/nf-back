import { VM } from 'vm2';
import { api, common } from '@nfjs/core';

/**
 * Вычисление дополнительных свойств объекта методом compose значений из сессии пользователя (те которые не уходят на клиента никогда)
 * @param {SessionAPI} session - пополняемый
 * @param {string} compose - строка компоновки объекта
 */
export function composeServerArgs(session, compose) {
    let _compose = compose;
    let res;
    if (_compose && _compose.startsWith('_compose')) {
        _compose = _compose.replace(/@@/g, '').replace(/@/g, '__sess.');
        const vm = new VM({
            sandbox: {
                __args: {},
                __sess: { ...session.get('context') },
                _compose: common.compose,
            },
        });
        try {
            res = vm.run(_compose);
        } catch (e) {
            throw api.nfError(e, 'Ошибка в _compose серверных аргументов.');
        }
    }
    return res;
}
