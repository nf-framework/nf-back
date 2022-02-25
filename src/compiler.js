import hbc from 'handlebars';
import promised_handlebars from 'promised-handlebars';
import hbh from 'just-handlebars-helpers';
import { api } from '@nfjs/core';
import { dataProviders } from '../index.js';

const hb = promised_handlebars(hbc);
hbh.registerHelpers(hb);
hb.registerHelper('js', async (options) => dataProviders.js.query(null, options.fn(this), options.data.root));

/**
 * Применение шаблонизирования handlebars к строке
 * @param {string} text - обрабатываемая строка
 * @param {Object} args - значения для переменных шаблона
 * @return {Promise<string>}
 */
async function compileEndpointText(text, args) {
    try {
        const compiled = hb.compile(text);
        return compiled(args);
    } catch (e) {
        throw api.nfError(e, 'Ошибка при компилировании запроса.');
    }
}

export {
    compileEndpointText,
};
