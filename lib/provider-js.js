import { api, debug } from '@nfjs/core';
import { NFProvider } from './provider.js';

const sandbox = {};

export class NFJsProvider extends NFProvider {
    async query(connect, statement, params, options, control) {
        // TODO: выдавать параметры ошибки только при дебаг режиме
        const tmng = {};
        try {
            debug.timingStart(tmng, 'execute');

            const vm = new VM({
                sandbox: {
                    params: params,
                    data: (options?.rowMode ?? 'array') === 'array' ? [] : {},
                    metaData: undefined,
                    rowMode: undefined
                },
            });
            const { __context, __session } = params;
            const context = __context || (__session && { session: __session });
            const _api = { context,
                require: (name) => _api[name],
                ...sandbox };
            vm.freeze(_api, 'api');
            const script = new VMScript(`async function run(){${statement};}; run()`);
            // let script = new VMScript("[10]")
            const data = await vm.run(script);
            if (data !== undefined) {
                return data;
            }
            const queryResult = vm._context.data;
            const metaData = vm._context.metaData;
            const rowMode = vm._context.rowMode;
            debug.timingEnd(tmng, 'execute');
            const response = {
                data: Array.isArray(queryResult) ? queryResult : [queryResult],
                debug: { timing: { provider: tmng } },
            };
            if (metaData) {
                response.metaData = metaData;
                response.rowMode = rowMode;
            }
            return response;
        } catch (e) {
            throw api.nfError(e, NFProvider.getMsg('executeQueryFailed'), { debug: {} });
        }
    }
}