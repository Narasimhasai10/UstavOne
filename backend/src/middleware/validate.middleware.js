export function validate(schema) {
  return async (req, res, next) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (err) {
      if (err.errors) {
        const fields = {};
        for (const e of err.errors) {
          const path = e.path.join('.');
          fields[path] = e.message;
        }
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: err.errors[0]?.message || 'Validation failed',
            fields
          }
        });
      }
      next(err);
    }
  };
}
