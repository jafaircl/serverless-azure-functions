import fs from "fs";
import path from "path";
import Serverless from "serverless";
import { FunctionMetadata, Utils } from "../shared/utils";

/**
 * Adds service packing support
 */
export class PackageService {
  public constructor(private serverless: Serverless) {
  }

  /**
   * Creates the function.json binding files required for the serverless service
   */
  public createBindings(): Promise<any[]> {
    const createEventsPromises = this.serverless.service.getAllFunctions()
      .map((functionName) => {
        const metaData = Utils.getFunctionMetaData(functionName, this.serverless);
        return this.createBinding(functionName, metaData);
      });

    return Promise.all(createEventsPromises);
  }

  /**
   * Prepares a serverless project for webpack and copies required files including
   * host.json and function.json files
   */
  public prepareWebpack() {
    const filesToCopy: string[] = [];
    if (fs.existsSync("host.json")) {
      filesToCopy.push("host.json");
    }

    this.serverless.service.getAllFunctions().forEach((functionName) => {
      const functionJsonPath = path.join(functionName, "function.json");
      if (fs.existsSync(functionJsonPath)) {
        filesToCopy.push(functionJsonPath);
      }
    });

    this.serverless.cli.log("Copying files for webpack");
    filesToCopy.forEach((filePath) => {
      const destinationPath = path.join(".webpack", "service", filePath);
      const destinationDirectory = path.dirname(destinationPath);
      if (!fs.existsSync(destinationDirectory)) {
        fs.mkdirSync(destinationDirectory);
      }
      fs.copyFileSync(filePath, destinationPath);
      this.serverless.cli.log(`-> ${destinationPath}`);
    });

    return Promise.resolve();
  }

  /**
   * Cleans up generated function.json files after packaging has completed
   */
  public cleanUp() {
    this.serverless.service.getAllFunctions().map((functionName) => {
      // Delete function.json if exists in function folder
      const filePath = path.join(functionName, "function.json");
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete function folder if empty
      const items = fs.readdirSync(functionName);
      if (items.length === 0) {
        fs.rmdirSync(functionName);
      }
    });

    return Promise.resolve();
  }

  /**
   * Creates the function.json for for the specified function
   */
  public createBinding(functionName: string, functionMetadata: FunctionMetadata) {
    const functionJSON = functionMetadata.params.functionsJson;
    functionJSON.entryPoint = functionMetadata.entryPoint;
    functionJSON.scriptFile = functionMetadata.handlerPath;

    const functionDirPath = path.join(this.serverless.config.servicePath, functionName);
    if (!fs.existsSync(functionDirPath)) {
      fs.mkdirSync(functionDirPath);
    }

    fs.writeFileSync(path.join(functionDirPath, "function.json"), JSON.stringify(functionJSON, null, 2));

    return Promise.resolve();
  }
}