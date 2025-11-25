const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const swiftSource = path.join(projectRoot, "resources", "macos-hotkey-listener.swift");
const outputDir = path.join(projectRoot, "resources", "bin");
const outputBinary = path.join(outputDir, "macos-hotkey-listener");

function log(message) {
  console.log(`[hotkey-listener] ${message}`);
}

function main() {
  if (process.platform !== "darwin") {
    log("Skipping macOS hotkey listener compilation on non-macOS platform.");
    process.exit(0);
  }

  if (!fs.existsSync(swiftSource)) {
    console.error(`[hotkey-listener] Swift source not found at ${swiftSource}`);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    log(`Creating output directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  log(`Compiling Swift source: ${swiftSource}`);
  log(`Output binary: ${outputBinary}`);

  try {
    // Compile for both architectures
    const arm64Binary = `${outputBinary}-arm64`;
    const x64Binary = `${outputBinary}-x64`;

    log("Compiling for arm64...");
    execSync(
      `swiftc -O -target arm64-apple-macosx11.0 -o "${arm64Binary}" "${swiftSource}"`,
      { stdio: "inherit" }
    );

    log("Compiling for x86_64...");
    execSync(
      `swiftc -O -target x86_64-apple-macosx11.0 -o "${x64Binary}" "${swiftSource}"`,
      { stdio: "inherit" }
    );

    log("Creating universal binary...");
    execSync(`lipo -create -output "${outputBinary}" "${arm64Binary}" "${x64Binary}"`, {
      stdio: "inherit",
    });

    // Clean up intermediate binaries
    fs.unlinkSync(arm64Binary);
    fs.unlinkSync(x64Binary);

    log("Compilation successful!");
  } catch (compileError) {
    console.error("[hotkey-listener] Failed to compile macOS hotkey listener binary.");
    console.error(compileError.message);
    process.exit(1);
  }

  try {
    fs.chmodSync(outputBinary, 0o755);
    log("Set executable permissions on binary.");
  } catch (error) {
    console.warn(`[hotkey-listener] Unable to set executable permissions: ${error.message}`);
  }

  log("Done!");
}

main();
