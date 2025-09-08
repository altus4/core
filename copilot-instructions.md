# GitHub Copilot Instructions for Altus4 Core

This document provides guidelines and best practices for using GitHub Copilot in the Altus4 Core project.

## Purpose

GitHub Copilot is used to assist with code generation, refactoring, documentation, and test creation in this repository. Follow these instructions to ensure Copilot-generated code is consistent, secure, and maintainable.

## General Guidelines

- **Code Style:**
  - Follow the project's existing code style and conventions (TypeScript, Node.js).
  - Use consistent naming, indentation, and formatting.
- **Documentation:**
  - Add JSDoc comments to all public functions, classes, and modules.
  - Update README.md and other documentation files when adding new features.
- **Testing:**
  - Write unit and integration tests for all new code (see `tests/` and Jest configs).
  - Ensure tests pass before submitting changes.
- **Security:**
  - Avoid hardcoding secrets or credentials.
  - Use environment variables and secure storage for sensitive data.
- **Error Handling:**
  - Implement proper error handling and logging (see `middleware/errorHandler.ts`).
  - Validate all inputs and outputs.

## Copilot Usage

- **Prompting:**
  - Use clear, descriptive prompts when requesting code from Copilot.
  - Specify file names, function signatures, and expected behavior.
- **Review:**
  - Always review Copilot-generated code for correctness and security.
  - Refactor or rewrite code as needed to match project standards.
- **Dependencies:**
  - Use only approved dependencies. Update `package.json` and run `npm install` as needed.
- **OpenAPI:**
  - Keep the OpenAPI spec (`openapi/altus4.openapi.yaml`) up to date with API changes.

## Workflow

1. **Create a branch for your changes.**
2. **Use Copilot to assist with code, tests, and documentation.**
3. **Review and refactor Copilot output.**
4. **Run tests and ensure all pass.**
5. **Update documentation as needed.**
6. **Open a pull request for review.**

## Additional Resources

- [README.md](./README.md)
- [Jest Configs](./jest.config.js, ./jest.integration.config.js)
- [OpenAPI Spec](./openapi/altus4.openapi.yaml)

## Contact

For questions or issues, contact the project maintainers listed in `README.md`.
