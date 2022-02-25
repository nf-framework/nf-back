import fs from 'fs/promises';
import { api } from '@nfjs/core';

export class ComponentCache {
    static async load(context, component, componentId) {
        if (context.cachedObj) return;
        const _componentId = componentId ?? `${context.params.form}/${context.params.id}`;
        const path = `${api.tempDir}/cache/${component}/${_componentId}`;
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

    static async save(cacheKey, object) {
        const path = `${api.tempDir}/cache${cacheKey}`;
        const dir = path.split('/');
        dir.pop();
        await fs.mkdir(dir.join('/'), {recursive: true});
        return fs.writeFile(path, JSON.stringify(object));
    }
}
