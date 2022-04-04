import { NFProvider } from './provider.js';

export class NFTestProvider extends NFProvider {
    async query(connect, statement, params, options, control) {
        const { rowMode = 'array', returnRN = false, returnFirst = false } = options;
        const row = (rowMode === 'array') ? ['foo', 1, true, new Date()] : { text: 'foo', numb: 1, bool: true, date: new Date() };
        const metaData = [
            { name: 'text', dataType: 'text' },
            { name: 'numb', dataType: 'numb' },
            { name: 'bool', dataType: 'bool' },
            { name: 'date', dataType: 'date', dataSubType: 'date' },
        ]
        if (returnRN) {
            if (Array.isArray(row)) {
                row.push(1);
            } else {
                row._rn = 1;
            }
            metaData.push({ name: '_rn', dataType: 'numb' });
        }
        return {
            data: (returnFirst) ? row : [row],
            metaData
        }
    }
}