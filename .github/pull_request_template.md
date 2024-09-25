## Reviewers Checklist

for complete review list refer to ABS Loop - Review Aspects

### Organizational Section

- [ ] PR is assigned to a reviewer
- [ ] PR is assigned to the according story/feature/bug
- [ ] Story/feature/bug is descriptive
- [ ] Story/feature/bug is assigned to a developer

### Structure

- [ ] Readability: Code is easy to understand, with meaningful names for variables, functions, and classes
- [ ] Comments: Meaningful and helpful comments. Code is documented without being over-commented
- [ ] DRY, KISS and YAGNI: Code implements only necessary features; no over-engineering
- [ ] No sensitive data (e.g., passwords, API keys) in the code
- [ ] No major updates for used packages

### Coding

- [ ] Model/Binding property changes or renaming does not break the code
- [ ] Model/Binding properties have consistent names (capitalization, lowercase, ..)
- [ ] Type aliases are defined for associations and compositions
- [ ] No hungarian notation (e.g. aList, oModel, ..)

### Most important (as long as we do not have Test Driven Development in place)

- [ ] Code is locally tested by developer

### Second most important

- [ ] API first: application can be used headless (with the API only)
