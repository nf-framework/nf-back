function query(options) {
    return async function (context) {
        const start = context.req.url.indexOf('?');
        if (start >= 0) {
            const qstr = decodeURIComponent(context.req.url.replace(/\+/g, ' ').slice(start + 1));
            const qarr = qstr.split('&');
            context.query = qarr.reduce((a, i) => {
                const qpart = i.split('=');
                a[qpart[0]] =
                    qpart[1] || '';
                return a;
            }, {});
        }
    };
}

export default query;
