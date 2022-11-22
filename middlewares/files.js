import busboy from 'busboy';

function files(options) {
    return async function (context) {
        return new Promise(resolve => {
            const bb = busboy({ headers: context.req.headers, defParamCharset: 'utf8' });

            bb.on('file', (name, file, fileInfo) => {
                context.fileInfo = {
                    fileName: fileInfo.filename,
                    fileStream: file,
                    encoding: fileInfo.encoding,
                    mimeType: fileInfo.mimeType
                };

                resolve();
            });

            context.req.pipe(bb);
        })
    };
}

export default files;
