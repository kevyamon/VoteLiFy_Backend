/**
 * Middleware d'assainissement et de validation déclarative via les schémas Zod.
 * Rejette toute charge utile non conforme et nettoie les champs non déclarés (anti Mass Assignment).
 */

/**
 * Valide le corps de la requête (req.body)
 * 
 * @param {import('zod').ZodSchema} schema
 */
export const validateBody = (schema) => async (req, res, next) => {
  try {
    req.body = await schema.parseAsync(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Valide les paramètres d'URL (req.params)
 * 
 * @param {import('zod').ZodSchema} schema
 */
export const validateParams = (schema) => async (req, res, next) => {
  try {
    req.params = await schema.parseAsync(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Valide les paramètres de requête d'URL (req.query)
 * 
 * @param {import('zod').ZodSchema} schema
 */
export const validateQuery = (schema) => async (req, res, next) => {
  try {
    req.query = await schema.parseAsync(req.query);
    next();
  } catch (error) {
    next(error);
  }
};
