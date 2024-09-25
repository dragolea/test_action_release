# F&CO - End of Year Accruals

## Table of contents

- [F\&Co End of Year Accruals](#fco-end-of-year-accruals)
  - [Table of contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
    - [`Dependencies`](#dependencies)
    - [`GitHub Labels`](#github-labels)
  - [Packages](#packages)
    - [Prettier](#prettier)
    - [ESLint](#eslint)
    - [Commit lint](#commit-lint)
      - [`Option 1:` Using GIT CLI](#option-1-using-git-cli)
      - [`Option 2:` Using Commit Lint CLI](#option-2-using-commit-lint-cli)
    - [Husky + Lint-staged](#husky--lint-staged)
    - [Git-cliff (Changelogs)](#git-cliff-changelogs)
      - [`Option 1`: Using GIT Cliff using CLI](#option-1-using-git-cliff-using-cli)
      - [`Option 2`: Using GIT Cliff in GITHUB Actions](#option-2-using-git-cliff-in-github-actions)
  - [Usage](#usage)

## Prerequisites

### `Dependencies`

Install [**@sap/cds-dk**](https://cap.cloud.sap/docs/get-started/), `typescript`, `ts-node` globally:

```bash
npm install -g @sap/cds-dk typescript ts-node
```

## Packages

The project includes:

- [CDS-TS-Dispatcher](https://github.com/dxfrontier/cds-ts-dispatcher) - Reduces boilerplate code for implementing TypeScript handlers in the SAP CAP framework.
- [CDS-TS-Repository](https://github.com/dxfrontier/cds-ts-repository) - Simplifies data access layer implementation by providing out-of-the-box database actions.
- [Prettier](https://prettier.io/) - Enforces a consistent code style
- [ESLint](https://eslint.org/) - Find and fix problems in your JavaScript/Typescript code
- [Commit lint](https://commitlint.js.org/) - Ensures high commit message quality by linting commit messages.
- [git-cliff (changelog)](https://git-cliff.org/docs/) - A highly customizable changelog generator
- Predefined folder structures **(Controller - Service - Repository design pattern)**:
  - **authorization**
  - **controller**
  - **middleware**
  - **repository**
  - **service**
  - **util**
- Predefined package.json scripts

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

### Prettier

To run Prettier, use the following command:

```bash
npm run prettier:fix
```

> [!TIP]
> By default: ESLint is triggered on the GIT `pre-commit`

> [!NOTE]
> ESLint uses `.prettierrc, .prettierignore` as a base configuration for the prettier.

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

### ESLint

To run ESLint, use the following command:

```bash
npm run eslint:fix
```

> [!TIP]
> By default: Prettier is triggered on the GIT `pre-commit`

> [!NOTE]
> ESLint uses `.eslintrc, .eslintignore` as a base configuration for the linter.

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

### Commit lint

Commit Lint offers two options to run the commit linter:

#### `Option 1:` Using GIT CLI

Create the commit using the GIT CLI:

```bash
# good example => commit lint will pass the commit
git add .
git commit -m "feat(util): added a util method"

# bad example => commit lint will throw an error
git commit -m "this feature is about a util method"
```

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

#### `Option 2:` Using Commit Lint CLI

Create the commit using the Commit Lint CLI:

```bash
npm run commit
```

> [!TIP]
> By default: commit lint is triggered in the GIT `commit-msg` hook

> [!NOTE]
> commit lint configuration `commitlintrc.ts` is used as a base configuration for linting commit messages.

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

### Husky + Lint-staged

The project provides by default on every `pre-commit` the run of the [ESLint](#eslint), [Prettier](#prettier), this means you do not have to run them manually, lint-staged will take care every time when you do a commit.

> [!TIP]
> Below you can find the two scripts added to the lint-staged :
>
> ```json
> "lint-staged": {
>  "**/*.{ts, tsx}": [
>    "npm run eslint:fix",
>    "npm run prettier:fix"
>  ]
> }
> ```

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

### Git-cliff (Changelogs)

To generate the `CHANGELOG.md` based on the latest commits, use the following command:

#### Using GIT Cliff using CLI

```bash
npx git-cliff@latest -o CHANGELOG.md
```

> [!NOTE]
> git cliff uses `cliff.toml` as a base configuration for the creation of the `CHANGELOG.md`

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

## Usage

1. `Create a New Branch:`
   - A developer starts by creating a new branch (example: `changes`) for their work.
     ```bash
     git checkout -b changes
     ```
2. `Make Changes:`

   - The developer makes changes, such as adding a `feature`, `fixing` a bug, or `updating` the README.

3. `Add and Commit Changes:`

   - The developer stages the changes and commits them using the commit lint conventional commits format.

   - Example of a good commit message:
     ```bash
     git add .
     git commit -m "feat(util): added a utility method"
     ```
     > [!TIP] > [Prettier](#prettier) and [ESLint](#eslint) will get triggered.

4. `Create a Pull Request:`

   - The developer creates a `pull request (PR)` and adds a reviewer.
   - Additionally the the according story, feature or bug should be added.
   - The developer should make sure that the related story, feature or bug is descriptive and assigned to a developer.

5. `Merge the PR:`

   - Once the reviews are <font color="green"> **successful** </font>, the developer merges the PR into the dev branch.
   - In case any updates on dev branch happended during review, the developer should make sure that these changes are reflected in this PR.  
     This can be done on the PR User Interface directly.
   - The related branch gets deleted automatically.

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>
