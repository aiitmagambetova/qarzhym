const { body, param, query } = require('express-validator');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (v) => DATE_RE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

const date = (f, { optional = false, loc = body } = {}) => {
  let c = loc(f);
  c = optional ? c.optional({ values: 'falsy' }) : c.notEmpty().withMessage('Күнді таңдаңыз').bail();
  return c.custom(realDate).withMessage('Күн форматы қате (ЖЖЖЖ-АА-КК)');
};
const amount = (f = 'amount') =>
  body(f).notEmpty().withMessage('Соманы енгізіңіз').bail()
    .custom((v) => /^\d+(\.\d{1,2})?$/.test(String(v))).withMessage('Сома дұрыс емес (ең көбі 2 ондық белгі)').bail()
    .custom((v) => Number(v) > 0 && Number(v) <= 1e10).withMessage('Сома 0-ден үлкен және 10 000 000 000-нан аз болуы керек');
const text = (f, max = 150, required = true) =>
  required
    ? body(f).trim().notEmpty().withMessage('Міндетті өріс толтырылмаған').bail().isLength({ max }).withMessage(`Ең көбі ${max} таңба`)
    : body(f).optional({ values: 'falsy' }).trim().isLength({ max }).withMessage(`Ең көбі ${max} таңба`);
const id = [param('id').isInt({ min: 1 }).withMessage('Жарамсыз идентификатор')];
const oneOf = (f, list, msg) => body(f).isIn(list).withMessage(msg);
module.exports = { body, param, query, date, amount, text, id, oneOf, realDate };
