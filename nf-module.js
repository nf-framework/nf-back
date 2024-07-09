import fs from 'fs';
import path from 'path';
import { config, api, common } from '@nfjs/core';

import { endpointData } from './src/endpoint-data.js';
import { endpointSql } from './src/endpoint-sql.js';
import { endpointAction } from './src/endpoint-action.js';
import { NFJsProvider } from './lib/provider-js.js';
import { web, dataProviders } from './index.js';
import json from './middlewares/json.js';
import query from './middlewares/query.js';
import files from './middlewares/files.js';

const __dirname = path.join(path.dirname(decodeURI(new URL(import.meta.url).pathname))).replace(/^\\([A-Z]:\\)/, '$1');
const menu = await api.loadJSON(`${__dirname}/menu.json`);

async function init() {
    const moduleConfig = common.getPath(config, '@nfjs/back') || {};
    let jsonCfg = Object.assign({ limit: '5Mb'},  moduleConfig?.json)
    web.registerMiddleware('json', json(jsonCfg));
    web.registerMiddleware('query', query());
    web.registerMiddleware('files', files());

    const { includeTimeZone } = config.client || {};
    Date.prototype.toJSON = function () {
        const tzo = -this.getTimezoneOffset(),
            dif = tzo >= 0 ? '+' : '-',
            pad = function (num) {
                const norm = Math.floor(Math.abs(num));
                return (norm < 10 ? '0' : '') + norm;
            },
            pad3 = function (num) {
                const norm = Math.floor(Math.abs(num));
                return (norm < 10 ? '00' : (norm < 100 ? '0' : '')) + norm;
            };
        return `${this.getFullYear()
        }-${pad(this.getMonth() + 1)
        }-${pad(this.getDate())
        }T${pad(this.getHours())
        }:${pad(this.getMinutes())
        }:${pad(this.getSeconds())
        }.${pad3(this.getMilliseconds())
        }${includeTimeZone ? (`${dif + pad(tzo / 60)}:${pad(tzo % 60)}`) : ''}`;
    };

    dataProviders.js = new NFJsProvider({ type: 'nodejs', credentialsSource: 'session' }, 'js');

    if (web) {
        web.on(
            'POST',
            '/@nfjs/back/endpoint-sql/:sqlPath',
            { middleware: ['session', 'auth', 'json'] },
            async (context) => { await endpointData(context, endpointSql);}
        );
        web.on(
            'POST',
            '/@nfjs/back/endpoint-action/:actionPath',
            { middleware: ['session', 'auth', 'json'] },
            async (context) => { await endpointData(context, endpointAction);}
        );
    }

    if (config.https_port && config.ssl_keyfile && config.ssl_certfile) {
        web.run(config.https_port, {
            key: fs.readFileSync(config.ssl_keyfile),
            cert: fs.readFileSync(config.ssl_certfile)
        });
        // server443.timeout = 0;
        console.log(`\nApplication listening on port ${config.https_port} \n  https://${config.localhost_subdomain ? `${config.localhost_subdomain}.` : ''}localhost:${config.https_port}/`);
    }
    if (config.http_port) {
        web.run(config.http_port);
        // nf.web.timeout = 0;
        console.log(`\nApplication listening on port ${config.http_port} \n  http://${config.localhost_subdomain ? `${config.localhost_subdomain}.` : ''}localhost:${config.http_port}/`);
    }
}

export {
    init,
    menu,
};
