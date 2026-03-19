# Magic Modules Experiment

An experiment that lets you use Python modules or React components before they exist.

👉 [**Read the article**](https://labs.google/code/experiments/magic-modules)

## Building locally

1. Create a Firebase project with Realtime Database and Auth enabled

2. Make a `.env` file at the root, as a copy of [`.env.example`](./.env.example), filling out the necessary field(s)

3. Install dependencies and start the Vite server:
    ```bash
    $ npm install
    $ npm run dev
    ```

## Technical components

- **On-the-fly prototype generation** - simplified coding agent powered by Gemini, along with an in-browser runtime powered by [`esbuild-wasm`](https://www.npmjs.com/package/esbuild-wasm) and inspired by [JSNotebook](https://github.com/tschoffelen/jsnotebook).
- **In-browser Python runtime** - powered by [Pyodide](https://pyodide.org/), with a terminal UI powered by [xterm.js](https://xtermjs.org/).
