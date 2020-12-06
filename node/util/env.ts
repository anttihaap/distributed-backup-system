export const getRequiredEnvVar = (varName: string) => {
  const varValue = process.env[varName];
  if (varValue === undefined) throw `Env var ${varName} not set!`;
  return varValue;
};

export const getOptionalEnvVar = (varName: string) => {
  return process.env[varName];
};
