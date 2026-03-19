// Borrowed heavily from https://github.com/tschoffelen/jsnotebook/blob/main/lib/bundler/index.ts
import * as esbuild from "esbuild-wasm";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";

interface BundledResult {
  output: string;
  error: string;
  npmExternals?: string[];
}

let loaded = false;
let isLoading = false;

export async function loadEsbuild() {
  if (loaded) {
    return;
  }

  if (isLoading) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!isLoading) {
          clearInterval(interval);
          resolve("");
        }
      }, 100);
    });
  }

  isLoading = true;

  try {
    await esbuild.initialize({
      worker: true,
      wasmURL,
    });
    loaded = true;
  } catch (error) {
    if (!String(error).includes("more than once")) {
      console.warn("Error initializing ESBuild", error);
    }
  }
  isLoading = false;
}

export async function esBundle(
  modules: Record<string, string>
): Promise<BundledResult> {
  await loadEsbuild();
  try {
    let npmExternals: string[] = [];
    const result = await esbuild.build({
      entryPoints: ["index.ts"],
      bundle: true,
      minify: false,
      format: "esm",
      platform: "node",
      write: false,
      jsx: "automatic",
      resolveExtensions: [".ts", ".tsx"],
      external: ["react", "react-dom", "npm:*"],
      plugins: [
        loaderPlugin(modules, (pkgName) => {
          if (!npmExternals.includes(pkgName)) {
            npmExternals.push(pkgName);
          }
        }),
      ],
      define: {
        global: "window",
      },
    });
    return {
      output: result.outputFiles[0].text,
      npmExternals,
      error: "",
    };
  } catch (error) {
    return {
      output: "",
      error: String((error as any)?.message || error),
    };
  }
}

function loaderPlugin(
  modules: Record<string, string>,
  onRequestExternalPackage?: (pkgName: string) => void
): esbuild.Plugin {
  return {
    name: "fetch-plugin",
    setup(build: esbuild.PluginBuild) {
      // handle root entry file of user input
      build.onResolve({ filter: /^(\w+\.tsx?)$/ }, ({ path }) => {
        return { path, namespace: "app" };
      });

      // handle other modules in the list
      build.onResolve({ filter: /^.+$/ }, ({ path }) => {
        if (modules[path]) return { path, namespace: "app" };
      });

      // handle other modules in the list
      build.onResolve({ filter: /^npm:(.+)$/ }, ({ path }) => {
        onRequestExternalPackage?.(path.replace(/^npm:/, ""));
        return undefined;
      });

      // handle local modules
      build.onResolve({ filter: /\.\/(.+)$/ }, ({ path }) => {
        return { path: path.replace(/^\.\//, "") + ".tsx", namespace: "app" };
      });

      // handle root user input code
      build.onLoad({ filter: /^.*$/ }, ({ path }) => {
        if (!modules[path]) throw new Error("Module not provided: " + path);
        return {
          loader: "tsx",
          contents: modules[path],
        };
      });
    },
  };
}
