import util from 'util';
import bodyParser from 'body-parser';

function json(options) {
    const parser = bodyParser.json(options);
    /** @type function(object,object) */
    const x = util.promisify(parser);
    return async function (context) {
        await x(context.req, context.res);
        context.body = context.req.body;
    };
}

export default json;
