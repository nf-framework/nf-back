import { debug } from '@nfjs/core';

export async function endpointData(context, handler) {
    try {
        const resp = await handler(context);
        if (resp?.debug?.timing) {
            const tmng = debug.timingToHttpHeader(resp.debug.timing);
            context.headers({'Server-Timing': tmng });
        }
        context.send(resp, true);
    } catch(e) {
        console.error(e);
        context.code(500).end();
    }
}