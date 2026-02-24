export const errorHandler = (err, req, res, next) => {
  // Extract status code from error or default to 500
  const status = err.status || err.statusCode || 500;
  
  // Extract error message
  const message = err.message || 'Internal Server Error';

  // Ensure response is JSON
  res.setHeader('Content-Type', 'application/json');

  // Return JSON error response
  res.status(status).json({
    error: message,
    status: status,
    timestamp: new Date().toISOString()
  });
};
