import { SessionAPI } from './session-api.js';

/**
 * Контекст выполнения
 */
export class ExecContext {
    /** @type {SessionAPI} */
    session;

    constructor(opt) {
        Object.assign(this, opt);
    }
}
