import fs from 'fs/promises';
import { api } from '@nfjs/core';

export class ComponentCache {
    static getPath(context, component, componentId) {
        const _componentId = componentId ?? `${context.params.form}/${context.params.id}`;
        return `${api.tempDir}/cache/${component}/${_componentId}`;
    }

    static async load(context, component, componentId) {
        if (context.cachedObj) return;
        const path = ComponentCache.getPath(context, component, componentId);
        try {
            await fs.access(path, fs.F_OK);
        } catch (err) {
            await api.processHooks('component-cache-miss', undefined, context);
        }
        const data = await fs.readFile(path, 'utf8');
        try {
            context.cachedObj = JSON.parse(data);
        } catch (e) {
            // TODO: разобратся с ошибкой
            context.send(api.nfError(e).json());
        }
    }

    static async save(cacheKey, data) {
        const path = `${api.tempDir}/cache${cacheKey}`;
        const dir = path.split('/');
        dir.pop();
        await fs.mkdir(dir.join('/'), {recursive: true});
        return fs.writeFile(path, (typeof data === 'object') ? JSON.stringify(data) : data);
    }
}
