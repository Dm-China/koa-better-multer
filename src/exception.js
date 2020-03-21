module.exports = class FileVerifyException extends Error {
  constructor(err) {
    super();
    this.message = err || 'File does not match configuration'
  }
}