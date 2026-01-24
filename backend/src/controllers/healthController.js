// Health check controller
export const healthCheck = (req, res) => {
  res.json({
    status: 'Backend is running ✅',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};
