export const healthCheck = (req, res) => {
  res.json({
    status: 'ok',
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

export const readinessCheck = ({
  getDatabaseStatus,
  getDependencyStatus = async () => ({}),
  nodeEnv,
}) => async (req, res, next) => {
  try {
    const database = getDatabaseStatus();
    const dependencies = await getDependencyStatus();
    const requiredDependencyDown = Object.values(dependencies).some(
      (check) =>
        check?.required &&
        !['healthy', 'configured'].includes(check?.status),
    );
    const ready = database === 'connected' && !requiredDependencyDown;

    return res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      environment: nodeEnv,
      requestId: req.requestId,
      checks: {
        database,
        ...dependencies,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
};
