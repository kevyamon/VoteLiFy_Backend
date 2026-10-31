/**
 * Wrapper asynchrone pour intercepter les exceptions des contrôleurs et middlewares.
 * Transfère automatiquement toute erreur au middleware de traitement global d'Express.
 * 
 * @param {Function} executionHandler - Fonction asynchrone à exécuter
 * @returns {Function} Middleware Express sécurisé
 */
export const asyncHandler = (executionHandler) => {
  return (req, res, next) => {
    Promise.resolve(executionHandler(req, res, next)).catch(next);
  };
};
