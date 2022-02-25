import asyncBusboy from 'async-busboy';

function files(options) {
    return async function (context) {
        const { files } = await asyncBusboy(context.req);
        context.files = files;
    };
}

export default files;
