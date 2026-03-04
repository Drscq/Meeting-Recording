class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

class WorkflowError extends Error {
  constructor(message) {
    super(message);
    this.name = "WorkflowError";
  }
}

module.exports = {
  ConfigError,
  WorkflowError
};

